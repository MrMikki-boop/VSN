import { Constants as C, getSettings, getTags, getPortrait, updatePortrait, getEmptyActiveSpeakers, requestSettingsUpdate } from '../scripts/const.js';
import { PresetUIClass } from '../scripts/presetUIClass.js';
import { ActorPickerSub } from './actorPickerSub.js';

export class ActorPicker extends FormApplication {
    static instance = null;
    constructor(isDrag = true, changedPosition = null) {
        super();
        this.activeFilters = []
        this.isDrag = isDrag
        this.changedPosition = changedPosition
    }

    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['vn-actor-picker'],
            width: 625,
            height: 750,
            resizable: false,
            id: "ActorPicker",
            template: `modules/${C.ID}/templates/actorPicker.hbs`,
            title: `Actor Picker`,
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: false,
            scrollY: ['.ac-actor-list'],
            classes: ['z-index-1600'],
            dragDrop: [
                {
                    dragSelector: '.ac-actor-list li'
                },
                {
                    dragSelector: '.vn-ac-slot',
                },
                // Добавляем поддержку дропа актёров в область списка портретов
                {
                    dropSelector: '.ac-actor-list'
                }
            ]
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    async getData(options) {
        const settingData = getSettings()

        let data = {
            highlightEl: settingData.editActiveSpeaker,
            portraits: settingData.portraits || [],
        }
        data.portraits.sort((a, b) => a.name.localeCompare(b.name))

        // Проверка наполненности activeSpeakers
        const uiData = PresetUIClass.getActivePreset()
        const defaultSlotCount = game.settings.get(C.ID, "slotCount")
        if (!uiData.slotCount.left) uiData.slotCount.left = defaultSlotCount
        if (!uiData.slotCount.right) uiData.slotCount.right = defaultSlotCount
        const _empty = getEmptyActiveSpeakers();
        settingData.activeSpeakers = foundry.utils.mergeObject(settingData.activeSpeakers, _empty, {overwrite: false});
        // Активные слоты
        const numbersArr = (num) => ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].indexOf(num)+1
        data.activeSpeakers = Object.keys(settingData.activeSpeakers).reduce((acc, current) => {
            const posParts = current?.split(/(?=[A-Z])/)
            const index = numbersArr(posParts[1])
            if (!index || index == "null") return acc
            if (index <= uiData.slotCount[posParts[0]]) {
                acc[posParts[0]][index-1] = {...settingData.activeSpeakers[current], pos: current}
            }
            return acc
        }, {"left": [], "right": [], "center": []})
        data.activeSpeakers.right = data.activeSpeakers.right.reverse()

        data.filters = [
            {
                name: game.i18n.localize(`${C.ID}.actorPicker.generarFilter`),
                list: [{name: game.i18n.localize(`${C.ID}.actorPicker.npcFilter`), id: randomID()}, {name: game.i18n.localize(`${C.ID}.actorPicker.onScene`), id: randomID()}]
            }
        ]
        data.filters = data.portraits.reduce((acc, current) => {
            if (!current) return acc
            const tag = current.tag
            if (!tag) return acc
            if (!acc.find(f=>f.name == tag[0])) {
                acc.push({name: tag[0], list: [{name: tag[1], id: randomID()}]})
            } else if (!acc.find(f=>f.name == tag[0]).list.find(f=>f.name == tag[1])) {
                acc.find(f=>f.name == tag[0]).list.push({name: tag[1], id: randomID()})
            }
            return acc
        }, data.filters)

        return { ...data };
    }

    _filterActors(html) {
        const filterText = html[0].querySelector('.ac-search-input').value
        const filterList = Array.from(html[0].querySelectorAll('.ac-filter-option input:checked')).map((element) => element.getAttribute('data-name'))
        const settings = getSettings()
        const filterIsEmpty = filterText == "" && filterList.length == 0
        const filteredIds = filterIsEmpty ? settings.portraits.map(p => p.id) : settings.portraits.reduce((acc, current) => {
            if (filterText && current.name.toLowerCase().includes(filterText.toLowerCase())) {
                acc.push(current)
            }
            if (filterList.length > 0) {
                let filterTags = [current.tag[1]]
                // if (actor.type == "npc") filterTags.push("НПС")
                if (canvas.tokens.placeables.map(t => t.actor?.id).includes(current?.id)) filterTags.push(game.i18n.localize(`${C.ID}.actorPicker.onScene`))
                if (filterList.every(e => filterTags.includes(e))) acc.push(current)
            }
            return acc
        }, []).map(p => p.id)
        html[0].querySelectorAll('.ac-actor-list li').forEach(element => {
            element.style = `display: ${filteredIds.includes(element.dataset.id) ? 'flex' : 'none'};`
        })
    }

    // Новая функция для создания портрета из актёра
    async _createPortraitFromActor(actor) {
        const settings = getSettings()
        const useTokenForPortraits = game.settings.get(C.ID, "useTokenForPortraits")

        // Проверяем, существует ли уже портрет для этого актёра
        if (settings.portraits.some(p => p.id === actor.id)) {
            ui.notifications.warn(game.i18n.localize(`${C.ID}.actorPicker.portraitAlreadyExists`))
            return false
        }

        // Получаем изображение для портрета
        const getImg = (actor) => {
            if (useTokenForPortraits) {
                const img = actor.prototypeToken.texture.src
                return (img && img != "icons/svg/mystery-man.svg") ? img : null
            } else {
                // Логика поиска изображения в папке портретов по имени актёра
                // Эта часть может потребовать адаптации в зависимости от вашей структуры файлов
                return actor.prototypeToken.texture.src !== "icons/svg/mystery-man.svg" ? actor.prototypeToken.texture.src : null
            }
        }

        const portraitPath = getImg(actor)
        if (!portraitPath) {
            ui.notifications.error(game.i18n.localize(`${C.ID}.actorPicker.noImageFound`))
            return false
        }

        // Создаём новый портрет
        const newPortrait = {
            img: portraitPath,
            name: actor.prototypeToken.name,
            title: "",
            tag: getTags(actor.folder),
            id: actor.id,
            scale: 100,
            offsetXl: 0,
            offsetXr: 0,
            offsetY: 0,
            hasActor: true
        }

        settings.portraits.push(newPortrait)
        await requestSettingsUpdate(settings)
        ui.notifications.info(game.i18n.localize(`${C.ID}.actorPicker.portraitCreated`))
        return true
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Установка портрета на выбранный слот при клике ЛКМ
        html.find('.ac-actor-list li').on('click', async (event) => {
            if (["ac-open-button", "ac-edit-button", "ac-delete-button"].includes(event.target.classList[0])) return
            const actorData = getPortrait(event.currentTarget.dataset.id)
            if (actorData) {
                const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'))
                settings.activeSpeakers[settings.editActiveSpeaker] = actorData
                await requestSettingsUpdate(settings, {change: ["editPortrait"], positions: [settings.editActiveSpeaker]})
            }
        })
        // Кнопка открытия листа связанного персонажа
        html.find('.ac-open-button')?.on('click', async (event) => {
            const sheet = game.actors.get(event.currentTarget.parentElement.parentElement.dataset.id)?.sheet
            if (sheet) sheet.render(true)
        })
        // Кнопка редактирования портрета
        html.find('.ac-edit-button')?.on('click', async (event) => {
            const portraitData = getPortrait(event.currentTarget.parentElement.parentElement.dataset.id)
            new ActorPickerSub(portraitData.id).render(true)
        })
        // Кнопка удаления портрета
        html.find('.ac-delete-button')?.on('click', async (event) => {
            const settingData = getSettings()
            const id = event.currentTarget.parentElement.parentElement.dataset.id
            if (settingData.portraits.some(p => p.id == id)) {
                settingData.portraits = settingData.portraits.filter(p => p.id != id)
                await requestSettingsUpdate(settingData)
                ActorPicker.refresh()
            } else {
                ui.notifications.error(game.i18n.localize(`${C.ID}.errors.portraitNotFound`));
            }
        })
        // Поиск по тексту
        html.find('.ac-search-input').on('keyup', async (event) => {
            this._filterActors(html)
        })
        html.find('.ac-search-input').on('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
        // Очистка поля для ввода при клике ПКМ
        html.find('.ac-search-input').on('contextmenu', (event) => {
            event.preventDefault();
            event.currentTarget.value = ""
            this._filterActors(html)
        })
        // Поиск по фильтрам
        html.find('.ac-filter-option input').on('change', (event) => {
            this._filterActors(html)
        })
        // Смена редактируемого актера
        html.find('.vn-ac-slot').on('click', async (event) => {
            if (event.currentTarget.querySelector('img').src == "") {
                return;
            }
            const settingData = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'));
            const pos = event.currentTarget.dataset.pos
            settingData.editActiveSpeaker = pos
            const imgElements = Array.from(html.find('.vn-ac-slot'))
            imgElements.forEach(element => {
                if (element.dataset.pos == settingData.editActiveSpeaker) {
                    element.classList.add('vn-hlight')
                } else {
                    element.classList.remove('vn-hlight')
                }
            })
            await requestSettingsUpdate(settingData, {change: ["editActiveSpeaker"], value: pos})
        })
        // Удаление актёра из списка спикеров при клике ПКМ
        html.find('.vn-ac-slot').on('contextmenu', async (event) => {
            event.preventDefault();
            const settingData = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'));
            settingData.activeSpeakers[event.currentTarget.dataset.pos] = null
            await requestSettingsUpdate(settingData, {change: ["editPortrait"], positions: [event.currentTarget.dataset.pos]})
        })
    }

    static open(isDrag = true, changedPosition = null) {

        if (!this.instance) {
            this.instance = new ActorPicker(isDrag, changedPosition);
        }

        if (!this.instance.rendered) {
            this.instance.isDrag = isDrag
            this.instance.changedPosition = changedPosition
            this.instance.render(true);
        } else {
            this.instance.bringToTop();
        }
    }

    static close() {
        if (this.instance) {
            this.instance.close();
        }
    }

    static async refresh() {
        await this.instance?.render();
    }

    async _updateObject(event, formData) {
    }

    _onDragStart(event) {
        const img = $(event.currentTarget);
        const actorId = img[0].dataset.id
        if (!actorId) return false
        const actorFlags = getPortrait(actorId)
        if (actorFlags) event.dataTransfer.setData("text/plain", JSON.stringify([actorFlags, img[0].dataset.pos]));
    }

    async _onDrop(event) {
        const droppedData = event.dataTransfer.getData('text/plain');

        // Проверяем, является ли дроп актёром из sidebar
        if (droppedData.startsWith('{"type":"Actor"')) {
            const actorData = JSON.parse(droppedData);
            const actor = game.actors.get(actorData.uuid?.split('.')[1] || actorData.id);

            if (actor && event.target.closest('.ac-actor-list')) {
                // Создаём портрет из актёра
                const success = await this._createPortraitFromActor(actor);
                if (success) {
                    ActorPicker.refresh();
                }
                return;
            }
        }

        // Существующая логика для дропа портретов на слоты
        if (!droppedData || droppedData === "") return

        try {
            const transferData = JSON.parse(droppedData)
            const settings = getSettings()

            // Аналогично с EditWindow - я потом сделаю по-человечески и без "или" элемента в if снизу. Наверное.
            if (event.target?.classList?.contains("vn-ac-slot") || event.target?.parentElement?.classList?.contains("vn-ac-slot")) {
                settings.activeSpeakers[transferData[1]] = getPortrait(event.target.dataset.id, settings) || null
                settings.activeSpeakers[event.target.dataset.pos] = transferData[0]
                await requestSettingsUpdate(settings, {change: ["editPortrait"], positions: [event.target.dataset.pos, transferData[1]]})
            } else {
                return false
            }
        } catch (e) {
            // Если не удалось распарсить как JSON, игнорируем
            return false;
        }
    }

    // Новая функция для создания портрета из актёра
    async _createPortraitFromActor(actor) {
        const settings = getSettings()
        const useTokenForPortraits = game.settings.get(C.ID, "useTokenForPortraits")

        // Проверяем, существует ли уже портрет для этого актёра
        if (settings.portraits.some(p => p.id === actor.id)) {
            ui.notifications.warn(`Портрет для ${actor.name} уже существует`)
            return false
        }

        // Получаем изображение для портрета
        const getImg = (actor) => {
            if (useTokenForPortraits) {
                const img = actor.prototypeToken.texture.src
                return (img && img != "icons/svg/mystery-man.svg") ? img : null
            } else {
                // Пытаемся найти изображение в папке портретов по имени актёра
                // Если не найдено, используем изображение токена
                return actor.prototypeToken.texture.src !== "icons/svg/mystery-man.svg" ? actor.prototypeToken.texture.src : null
            }
        }

        const portraitPath = getImg(actor)
        if (!portraitPath) {
            ui.notifications.error(`Не найдено подходящее изображение для ${actor.name}`)
            return false
        }

        // Создаём новый портрет
        const newPortrait = {
            img: portraitPath,
            name: actor.prototypeToken.name,
            title: "",
            tag: getTags(actor.folder),
            id: actor.id,
            scale: 100,
            offsetXl: 0,
            offsetXr: 0,
            offsetY: 0,
            hasActor: true
        }

        settings.portraits.push(newPortrait)
        await requestSettingsUpdate(settings)
        ui.notifications.info(`Портрет для ${actor.name} успешно создан`)
        return true
    }
}

// Остальные функции остаются без изменений
async function fullPortraitsCheck(_actors = []) {
    let allPortraits = await FilePicker.browse("data", C.portraitFoldersPath())
    allPortraits = allPortraits.files.map(f => decodeURI(f).replace(`%2C`, `,`).replace(`${C.portraitFoldersPath()}/`, ``)).sort((a, b) => b.length - a.length)
    const actors = (_actors.length > 0) ? _actors : game.actors.contents
    let settings = getSettings()
    const useTokenForPortraits = game.settings.get(C.ID, "useTokenForPortraits")
    const getImg = (actor) => {
        if (useTokenForPortraits) {
            const img = actor.prototypeToken.texture.src
            return (img && img != "icons/svg/mystery-man.svg") ? img : null
        } else {
            let img = allPortraits.find(n => actor.prototypeToken.name.toLowerCase().includes(n.toLowerCase().replace(/.[^/.]+$/, '')))
            img = img ? `${C.portraitFoldersPath()}/${img}` : null
            return img
        }
    }
    // Проходимся по всем актёрам
    for (let i = 0; i < actors.length; i++) {
        console.log(game.i18n.localize(`${C.ID}.actorPicker.checkingActor`), actors[i].name)
        const actor = actors[i]
        let flag = getPortrait(actor.id, settings)

        // Миграция со старой системы хранения данных портретов
        const _oldFlag = deepClone(actor.getFlag(C.ID, "portraitData"))
        if (_oldFlag) {
            flag = _oldFlag
            await actor.unsetFlag(C.ID, "portraitData")
        }

        if (flag == "lockChange") continue
        if (!flag) {    // Если флага нету, ищем подходящий портрет, и при наличии такового - устанавливаем флаги
            const portraitPath = getImg(actor)
            if (portraitPath) {
                flag = {
                    img: portraitPath,
                    name: actor.prototypeToken.name,
                    title: "",
                    tag: getTags(actor.folder),
                    id: actor.id,
                    scale: 100,
                    offsetXl: 0,
                    offsetXr: 0,
                    offsetY: 0,
                    hasActor: true
                }
                settings.portraits.push(flag)
            }
        } else {        // Если флаг есть, проверяем данные портрета
            let _img = flag.img
            const _imgIsFine = await srcExists(_img || "")
            console.log("_imgIsFine", _imgIsFine)
            if (!_imgIsFine) _img = getImg(actor)
            if (!_img || _img == `${C.portraitFoldersPath()}/`) {
                settings.portraits = settings.portraits.filter(f => f.id !== actor.id)
                continue
            } else {
                const newFlag = {
                    img: _img,
                    name: flag.name || actor.prototypeToken.name,
                    title: flag.title || "",
                    tag: getTags(actor.folder),
                    id: actor.id,
                    scale: flag.scale || 100,
                    offsetXl: flag.offsetXl || 0,
                    offsetXr: flag.offsetXr || 0,
                    offsetY: flag.offsetY || 0,
                    hasActor: true
                }
                if (_oldFlag || !foundry.utils.objectsEqual(flag, newFlag)) {
                    const _temp = await updatePortrait(newFlag.id, newFlag, settings, true)
                    settings.portraits = _temp.portraits
                }
            }
        }
    }
    await requestSettingsUpdate(settings)
    ActorPicker.refresh()
}

Hooks.on("getActorPickerHeaderButtons", (app, buttons) => {
    buttons.unshift({
        label: `${C.ID}.actorPicker.header-button`,
        class: "ap-header-button-search",
        icon: "fas fa-magnifying-glass",
        onclick: fullPortraitsCheck
    });
    buttons.unshift({
        label: `${C.ID}.actorPicker.add-portrait-button`,
        class: "ap-header-button-add",
        icon: "fas fa-user-plus",
        onclick: () => {new ActorPickerSub().render(true)}
    })
});

Hooks.on("updateActor ", async (actor, update, changes, userId) => {
    await fullPortraitsCheck([actor])
})

Hooks.on("renderActorSheet5e", async (app, html, data) => {
    await fullPortraitsCheck([app.actor])
    const isActor = app.actor.type == "character"
    let flag = getPortrait(app.actor.id) || {}
    const lockPortraitChange = app.actor.getFlag(C.ID, "lockPortraitChange")
    // Рендер кнопки выбора портрета
    let iEl = document.createElement('i');
    if (app.template.includes("tidy5e-sheet")) {
        const appPortraitEl = html[0].querySelector('.svelte-cixcnb')
        const icon = lockPortraitChange ? "fa-user-large-slash" : "fa-user"
        iEl.className = `fa-${flag.img ? "solid" : "regular"} ${icon} ap-tidyui-alter`
        iEl.dataset.tooltip = game.i18n.localize(`${C.ID}.actorPicker.tooltip`);
        appPortraitEl.appendChild(iEl);
    } else if (isActor) {
        iEl.className =`fa-${flag.img ? "solid" : "regular"} ${lockPortraitChange ? "fa-user-large-slash" : "fa-user"}`
        let buttonEl = document.createElement('button');
        buttonEl.className = `collapser card-tab vertical unbutton interface-only ap-button-spec`
        buttonEl.dataset.tooltip = game.i18n.localize(`${C.ID}.actorPicker.tooltip`);
        buttonEl.appendChild(iEl);
        const elementForIcon = html[0].querySelector('.sidebar .card')
        elementForIcon.querySelector('.collapser.card-tab').classList.add('ap-collapse-spec')
        elementForIcon.appendChild(buttonEl);
    } else {
        let headerElement = html[0].querySelector('.sheet-header');
        headerElement.classList.add('ap-pos-rel');
        const icon = lockPortraitChange ? "fa-user-large-slash" : "fa-user"
        iEl.className = `fa-${flag.img ? "solid" : "regular"} ${icon} ap-sheet-portrait`
        iEl.dataset.tooltip = game.i18n.localize(`${C.ID}.actorPicker.tooltip`);
        headerElement.appendChild(iEl);
    }
    iEl.addEventListener('click', (event) => {
        event.preventDefault();
        new ActorPickerSub(app.actor.id).render(true)
    });
    iEl.addEventListener('contextmenu', async (event) => {
        event.preventDefault();
        await app.actor.setFlag(C.ID, "lockPortraitChange", !lockPortraitChange)
    });
})


Hooks.on("getActorSheetHeaderButtons", async (app, buttons) => {
    if (game.settings.get(C.ID, "headerPortraitButton") || game.system.id != "dnd5e") {
        const portraitData = getPortrait(app.actor.id) || {}
        buttons.unshift({
            label: `${C.ID}.actorPicker.tooltip`,
            class: "ap-header-button",
            icon: `fa-${portraitData.img ? "solid" : "regular"} ${app.actor.getFlag(C.ID, "lockPortraitChange") ? "fa-user-large-slash" : "fa-user"}`,
            onclick: async () => {new ActorPickerSub(app.actor.id).render(true)}
        });
    }
})

Hooks.on("updateSetting", async (setting, value, diff, userId) => {
    if (setting.key == `${C.ID}.vnData`) {
        const app = document.getElementById("ActorPicker")
        if (app) {
            const settingData = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'))
            app.querySelectorAll(".vn-ac-slot").forEach(element => {
                const pos = element.dataset.pos
                element.dataset.id = settingData.activeSpeakers[pos]?.id
                element.querySelector("img").src = settingData.activeSpeakers[pos]?.img || ""
                if (pos == settingData.editActiveSpeaker) {
                    element.classList.add("vn-hlight")
                } else {
                    element.classList.remove("vn-hlight")
                }
            })
        }
    }
})