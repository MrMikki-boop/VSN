import { Constants as C, getSettings, getLocation, updatePortrait, getPortrait, selectorArray, getEmptyActiveSpeakers, getTextureSize, requestSettingsUpdate, allowTo, setFontsSize, getTime, uiButtonsIcons, useSimpleCalendar } from "./const.js";
import { ActorPicker } from "../apps/actorPicker.js";
import { LocationPicker, LocationPickerSettings } from "../apps/locationPicker.js";
import { SlidersSetClass } from "./slidersSetClass.js";
import { VisualSettingsMenu } from "../apps/visualSettingsMenu.js";
import { PresetUIClass } from "./presetUIClass.js";

const _getTemperatureColor = (temperature) => {
    if (!temperature) {
        return "";
    }
    const colors = {
        color1: {red: 0, green: 15, blue: 115},
        color2: {red: 85, green: 255, blue: 0},
        color3: {red: 255, green: 30, blue: 0},
    }
    let fade = (temperature+100)/100;
    if (fade >= 1) {
        fade -= 1;
        colors.color1 = {red: 85, green: 255, blue: 0};
        colors.color2 = {red: 255, green: 30, blue: 0};
    }
    const gradient = {
        red: parseInt(Math.floor(colors.color1.red + ((colors.color2.red - colors.color1.red) * fade)), 10),
        green: parseInt(Math.floor(colors.color1.green + ((colors.color2.green - colors.color1.green) * fade)), 10),
        blue: parseInt(Math.floor(colors.color1.blue + ((colors.color2.blue - colors.color1.blue) * fade)), 10),
    }
    return `rgba(${gradient.red}, ${gradient.green}, ${gradient.blue}, 1)`;
}

function editWindowActorUpdate(pos = "") {
    const editWindow = document.getElementById('vn-edit-window')
    if (!editWindow) return
    const settingData = getSettings();
    pos = pos || settingData.editActiveSpeaker
    const activeSpeaker = settingData.activeSpeakers[pos] || {}
    const _isLeft = pos.includes("left")
    const offsetX = activeSpeaker[_isLeft ? "offsetXl" : "offsetXr"] || 0
    const offsetY = activeSpeaker.offsetY || 0
    const scale = activeSpeaker.scale || 100
    // Изображение
    const ewPortraitEl = editWindow.querySelector(`.vn-ew-portraits img[data-pos="${pos}"]`)
    ewPortraitEl.src = activeSpeaker.img || ""
    ewPortraitEl.style.transform = `scaleX(${(_isLeft !== !!activeSpeaker.mirrorX ? -1 : 1)})`
    if (activeSpeaker.img) {
        ewPortraitEl.style.display = null
    } else {
        ewPortraitEl.style.display = "none"
    }
    ewPortraitEl.dataset.id = activeSpeaker.id || ""
    editWindow.querySelector(`.vn-ew-slot[data-pos="${pos}"]`).dataset.id = activeSpeaker.id || ""
    // Изображение в окне Actor Picker
    const actorPickerApp = document.getElementById("ActorPicker")
    if (actorPickerApp) {
        const apPortraitEl = actorPickerApp.querySelector(`.ac-portraits img[data-pos="${pos}"]`)
        if (apPortraitEl) {
            apPortraitEl.src = activeSpeaker.img || ""
            apPortraitEl.dataset.id = activeSpeaker.id || ""
        }
    }
    if (pos == settingData.editActiveSpeaker) {
        // Имя и титул
        editWindow.querySelector(`.vn-edit-name`).value = activeSpeaker.name || ""
        editWindow.querySelector(`.vn-edit-title`).value = activeSpeaker.title || ""
        // Смещение и масштаб
        editWindow.querySelector(`.range-scale-value`).textContent = scale
        document.getElementById(`vn-edit-scale`).value = scale
        editWindow.querySelector(`.range-coordX-value`).textContent = offsetX*(_isLeft ? -1 : 1)
        document.getElementById(`vn-edit-offsetX`).value = offsetX*(_isLeft ? -1 : 1)
        editWindow.querySelector(`.range-coordY-value`).textContent = offsetY*-1
        document.getElementById(`vn-edit-offsetY`).value = offsetY*-1
        // Дополнительные настройки
        document.getElementById("vn-edit-mirrorX").checked = activeSpeaker.mirrorX
        document.getElementById("vn-edit-widthEqualFrame").checked = activeSpeaker.widthEqualFrame

        editWindow.querySelectorAll("input").forEach(el => {
            el.classList.remove("vn-hlight")
        })
        editWindow.querySelectorAll(".vn-edit-additional div").forEach(el => {
            el.classList.remove("vn-hlight")
        })
    }
    // Заметка для себя: это нужно на всякий случай, например при отмене изменений в EditWindow
    if (activeSpeaker.img) {
        const actorEl = getActorEl(pos);
        actorEl.style.top = `${offsetY - game.settings.get(C.ID, "worldOffsetY")}px`;
        actorEl.style.left = `${offsetX}px`;
        actorEl.style.transform = `scale(${scale}%)`;
    }
}

async function autoAssignSlots(settingData) {
    if (!game.settings.get(C.ID, "autoAssignSlots")) return;

    // Используем токены только с активной сцены, если она есть
    const actors = canvas.scene ? canvas.scene.tokens.map(t => t.actor).filter(a => a) : [];
    const activeSpeakers = { ...settingData.activeSpeakers };
    const slots = ["First", "Second", "Third", "Fourth", "Fifth"];
    const leftSlots = slots.map(s => `left${s}`);
    const rightSlots = slots.map(s => `right${s}`);

    // Сохраняем существующие левые слоты (для игроков)
    const persistentLeft = {};
    leftSlots.forEach(slot => {
        if (activeSpeakers[slot]?.id) {
            persistentLeft[slot] = activeSpeakers[slot];
        }
    });

    // Очищаем левые и правые слоты, если есть активная сцена
    if (canvas.scene) {
        leftSlots.forEach(slot => {
            if (!persistentLeft[slot]) delete activeSpeakers[slot];
        });
        rightSlots.forEach(slot => {
            delete activeSpeakers[slot];
        });
    }

    // Распределяем персонажей только если есть активная сцена
    if (canvas.scene) {
        let leftIndex = 0;
        let rightIndex = 0;
        for (const actor of actors) {
            const isPlayer = Object.keys(actor.ownership).some(userId => {
                const user = game.users.get(userId);
                return user && !user.isGM && actor.ownership[userId] >= 3;
            });
            const slot = isPlayer ? leftSlots[leftIndex] : rightSlots[rightIndex];
            if (isPlayer && leftIndex < leftSlots.length && !persistentLeft[slot]) {
                activeSpeakers[slot] = {
                    id: actor.id,
                    img: game.settings.get(C.ID, "useTokenForPortraits") ? actor.prototypeToken?.texture?.src || actor.img : actor.img,
                    name: actor.name,
                    title: "",
                    offsetX: 0,
                    offsetY: 0,
                    scale: 100,
                    mirrorX: false,
                    widthEqualFrame: game.settings.get(C.ID, "worldWidthEqualFrame")
                };
                leftIndex++;
            } else if (!isPlayer && rightIndex < rightSlots.length) {
                activeSpeakers[slot] = {
                    id: actor.id,
                    img: game.settings.get(C.ID, "useTokenForPortraits") ? actor.prototypeToken?.texture?.src || actor.img : actor.img,
                    name: actor.name,
                    title: "",
                    offsetX: 0,
                    offsetY: 0,
                    scale: 100,
                    mirrorX: false,
                    widthEqualFrame: game.settings.get(C.ID, "worldWidthEqualFrame")
                };
                rightIndex++;
            }
        }
    }

    // Восстанавливаем сохранённые левые слоты
    Object.assign(activeSpeakers, persistentLeft);

    // Обновляем настройки, если были изменения
    if (JSON.stringify(activeSpeakers) !== JSON.stringify(settingData.activeSpeakers)) {
        settingData.activeSpeakers = activeSpeakers;
        await requestSettingsUpdate(settingData, { change: ["editActiveSpeakers"] });
    }
}

import { VNLocation } from '../scripts/locationClass.js';

async function updateSceneData(settingData) {
    if (!game.settings.get(C.ID, "autoSceneData") || !canvas.scene) return;

    const scene = canvas.scene;
    let location = settingData.location || {};

    // Получаем фон из сцены
    const sceneBackground = scene.background?.src || game.settings.get(C.ID, "backgroundPlaceholder");

    // Ищем существующую локацию с таким же фоном
    const existingLocation = settingData.locationList.find(loc => loc.backgroundImage === sceneBackground);

    if (existingLocation) {
        // Если локация уже есть в списке, используем её данные
        location = foundry.utils.deepClone(existingLocation);
        console.log(`Найдена существующая локация: ${location.locationName}`);
    } else {
        // Если локации нет, создаём новую с фоном из сцены
        location.backgroundImage = sceneBackground;
        location.locationName = "???";

        // Создаём объект новой локации для locationList
        const newLocationData = {
            locationName: "???",
            backgroundImage: sceneBackground,
            parentLocation: "",
            locationTags: [],
            weather: null,
            temperature: null,
            knowTime: true
        };

        // Парсим данные из journal сцены для новой локации
        if (scene.journal) {
            const journalContent = scene.journal.pages.contents[0]?.text?.content || "";

            // Родительская локация
            const parentMatch = journalContent.match(/<p>\s*Родительская локация:\s*([^<]+)\s*<\/p>/i);
            if (parentMatch) {
                newLocationData.parentLocation = parentMatch[1].trim();
            }

            // Температура
            const tempMatch = journalContent.match(/<p>\s*Температура:\s*([-]?\d+)\s*(?:°C|°F)?\s*<\/p>/i);
            if (tempMatch) {
                newLocationData.temperature = parseInt(tempMatch[1]);
            }

            // Время
            const timeMatch = journalContent.match(/<p>\s*Время:\s*([^<]+)\s*<\/p>/i);
            newLocationData.knowTime = !!timeMatch;
            if (timeMatch) {
                newLocationData.time = timeMatch[1].trim();
            }
        }

        // Создаём новую локацию и добавляем в список
        const vnLocation = new VNLocation(newLocationData);
        settingData.locationList.push(vnLocation);

        // Используем созданную локацию как текущую
        location = foundry.utils.deepClone(vnLocation);

        console.log(`Создана новая локация с фоном сцены: ${sceneBackground}`);
    }

    // Обновляем/дополняем данные локации из сцены (если есть journal)
    if (scene.journal) {
        const journalContent = scene.journal.pages.contents[0]?.text?.content || "";

        // Погода из заметок сцены
        const weatherMatch = journalContent.match(/<p>\s*Погода:\s*([^<]+)\s*<\/p>/i);
        if (weatherMatch) {
            const weatherName = weatherMatch[1].trim();
            let weather = settingData.weatherList.find(w => w.name === weatherName);

            if (!weather) {
                weather = {
                    name: weatherName,
                    icon: "fas fa-question",
                    id: foundry.utils.randomID()
                };
                settingData.weatherList.push(weather);
            }
            location.weather = weather;
        } else if (!location.weather) {
            // Если погода не указана и её нет в локации, ставим по умолчанию
            location.weather = settingData.weatherList.find(w => w.name === "Неизвестная погода");
        }

        // Время из заметок (если не используется Simple Calendar)
        if (!game.settings.get(C.ID, "useSimpleCalendar") || !game.modules.get("foundryvtt-simple-calendar")?.active) {
            const timeMatch = journalContent.match(/<p>\s*Время:\s*([^<]+)\s*<\/p>/i);
            location.knowTime = !!timeMatch;
            location.time = timeMatch ? timeMatch[1].trim() : settingData.clockTime || "12:30";
        }

        // Температура из заметок
        const tempMatch = journalContent.match(/<p>\s*Температура:\s*([-]?\d+)\s*(?:°C|°F)?\s*<\/p>/i);
        if (tempMatch) {
            location.temperature = parseInt(tempMatch[1]);
        }

        // Родительская локация из заметок
        const parentMatch = journalContent.match(/<p>\s*Родительская локация:\s*([^<]+)\s*<\/p>/i);
        if (parentMatch) {
            location.parentLocation = parentMatch[1].trim();
        }
    } else {
        // Если журнала нет, устанавливаем базовые значения
        if (!location.weather) {
            location.weather = settingData.weatherList.find(w => w.name === "Неизвестная погода");
        }

        if (game.settings.get(C.ID, "useSimpleCalendar") && game.modules.get("foundryvtt-simple-calendar")?.active) {
            location.knowTime = true;
        } else {
            location.knowTime = false;
            location.time = settingData.clockTime || "12:30";
        }
    }

    // Если была создана новая локация или обновлена существующая,
    // обновляем её в locationList
    if (existingLocation) {
        const locationIndex = settingData.locationList.findIndex(loc => loc.id === existingLocation.id);
        if (locationIndex !== -1) {
            // Обновляем локацию в списке, сохраняя её ID и другие важные поля
            settingData.locationList[locationIndex] = foundry.utils.mergeObject(
                settingData.locationList[locationIndex],
                {
                    weather: location.weather,
                    temperature: location.temperature,
                    knowTime: location.knowTime,
                    time: location.time,
                    parentLocation: location.parentLocation
                }
            );
        }
    }

    settingData.location = location;
    await requestSettingsUpdate(settingData, {
        change: ["location", "weatherList", "locationList"]
    });
}

const getActorEl = (pos) => {
    const settingData = getSettings();
    if (!pos) pos = settingData.editActiveSpeaker
    return document.querySelector(`.vn-portrait.${pos} img`)
};

export class VisualNovelDialogues extends FormApplication {
    static instance = null;
    constructor() {
        super();
    }

    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            popOut: false,
            classes: ['vn-body'],
            width: '100%',
            height: '100%',
            resizable: false,
            editable: false,
            template: `modules/${C.ID}/templates/vnBody.hbs`,
            title: `Visual Novel Dialogues`,
            userId: game.userId,
            closeOnSubmit: false,
            submitOnChange: false,
            dragDrop: [
                {
                    dragSelector: '.vn-ew-portraits img',
                },
                {
                    dragSelector: '.vn-mo-item',
                }
            ]
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }


    async getData() {
        const settingData = getSettings();
        // Автоматическое распределение слотов, если включено
        await autoAssignSlots(settingData);
        await updateSceneData(settingData);
        // Проверка наполненности activeSpeakers
        const _empty = getEmptyActiveSpeakers();
        settingData.activeSpeakers = foundry.utils.mergeObject(settingData.activeSpeakers, _empty, {overwrite: false});
        // Подготовка данных
        const activeLocation = settingData.location;
        const _requests = settingData.effects.requests
        // Кнопки справа сверху
        let _selectorArray = selectorArray()
        _selectorArray = Object.keys(_selectorArray).reduce((acc, current) => {
            acc.push({
                type: current,
                name: game.i18n.localize(`${current == "TabCompendium" ? "SIDEBAR" : "DOCUMENT"}.${current}`),
                icon: _selectorArray[current],
                active: game.settings.get(C.ID, `selector${current}`)
            })
            return acc
        }, [])

        const uiData = PresetUIClass.getActivePreset()
        const defaultSlotCount = game.settings.get(C.ID, "slotCount")
        if (!uiData.slotCount.left) uiData.slotCount.left = defaultSlotCount
        if (!uiData.slotCount.right) uiData.slotCount.right = defaultSlotCount

        // Активные слоты
        const numbersArr = (num) => ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].indexOf(num) + 1
        let _tempPortrait
        const worldOffsetY = game.settings.get(C.ID, "worldOffsetY")
        const worldWidthEqualFrame = game.settings.get(C.ID, "worldWidthEqualFrame")
        const _activeSpeakers = Object.keys(settingData.activeSpeakers).reduce((acc, current) => {
            const posParts = current?.split(/(?=[A-Z])/)
            const index = numbersArr(posParts[1])
            // Я так и не понял почему и когда, но *в каких-то случаях* ключём объекта settingData.activeSpeakers может быть null. Ключём. Не значением.
            if (!index || index == "null") return acc
            if (index <= uiData.slotCount[posParts[0]]) {
                _tempPortrait = settingData.activeSpeakers[current]
                if (_tempPortrait) {
                    _tempPortrait.offsetY -= worldOffsetY
                    if (worldWidthEqualFrame) _tempPortrait.widthEqualFrame = true
                }
                const isActive = [...settingData.activeSlots.left, ...settingData.activeSlots.right]?.includes(current)
                acc[posParts[0]][index - 1] = {
                    ..._tempPortrait,
                    zIndex: 31 - index - (isActive ? 0 : 10),
                    pos: current,
                    index: index,
                    active: isActive
                }
            }
            return acc
        }, {"left": [], "right": [], "center": []})
        _activeSpeakers.right = _activeSpeakers.right.reverse()
        // Неактивная очередь
        const _order = Object.keys(settingData.order).reduce((acc, current) => {
            for (let i = 0; i < 6; i++) {
                acc[current][i] = settingData.order[current][i] || {}
            }
            return acc
        }, {"left": [], "right": [], "center": []})

        const userPerm = game.user.role
        const permSettings = deepClone(game.settings.get(C.ID, "playersPermissions"))
        let shownElements = Object.keys(permSettings).reduce((acc, el) => {
            acc[el] = permSettings[el].includes(userPerm)
            return acc
        }, {})
        shownElements["honeycomb"] = shownElements["editWindow"] || shownElements["locationSubChanges"]

        const data = {
            // Данные сцены
            backgroundImage: activeLocation.backgroundImage.replace(`(`, `\\(`).replace(`)`, `\\)`),
            locationName: activeLocation.locationName,
            parentLocation: activeLocation.parentLocation,
            time: getTime(activeLocation.knowTime, settingData),
            weather: activeLocation.weather || settingData.weatherList.find(w => w.name == "Неизвестная погода"),
            weatherList: settingData.weatherList,
            temperature: activeLocation.temperature,
            temperatureColor: _getTemperatureColor(activeLocation.temperature),
            // Прочее
            activeSpeakers: _activeSpeakers,
            order: _order,
            editMode: settingData.editMode && shownElements["editWindow"],
            linkChanges: settingData.linkChanges,
            highlightEl: settingData.editActiveSpeaker,
            hideBack: settingData.hideBack,
            hideUI: settingData.hideUI,
            requests: Object.keys(_requests).map(m => {
                return {id: m, img: _requests[m].img, level: _requests[m].level}
            }).sort((a, b) => b.level - a.level),
            selectors: _selectorArray,
            selectorOpen: !!game.user.getFlag(C.ID, "selectorOpen"),
            players: deepClone(game.users.filter(u => u.active)).map(u => {
                return {
                    id: u.id,
                    name: u.name,
                    color: u.color,
                    hidden: u.getFlag(C.ID, "hideVN"),
                    active: settingData.showForIds ? settingData.showForIds?.includes(u.id) : true,
                }
            }),
            playerListOpen: !!game.user.getFlag(C.ID, "playerListOpen")
        }

        // Проверка того, на какой стороне расположен выбранный в окне редактирования персонаж (лево/право)
        // -- нужно для корректной работы ползунка изменения смещения портрета по оси X в зависимости от стороны в которой он находится (лево/право)
        const leftCheck = data.highlightEl.includes("left");
        // Данные окна редактирования
        const editActor = settingData.activeSpeakers[data.highlightEl]
        const editActorData = {
            name: editActor?.name || "",
            title: editActor?.title || "",
            scale: editActor?.scale || 100,
            offsetX: (editActor?.[leftCheck ? "offsetXl" : "offsetXr"]) * (leftCheck ? -1 : 1) || 0,
            offsetY: editActor?.offsetY * -1 || 0,
            mirrorX: editActor?.mirrorX || false,
            widthEqualFrame: editActor?.widthEqualFrame || false,
        }

        const _sideMainName = game.settings.get(C.ID, "sideMainName")
        const _addData = {
            hasEpicRoll: game.modules.get("epic-rolls-5e")?.active,
            showVN: settingData.showVN && !game.user.getFlag(C.ID, "hideVN")
                && (game.user.isGM || !settingData.showForIds || settingData.showForIds?.includes(game.user.id)),
            showHintButton: game.settings.get(C.ID, "hintButton"),
            forceDisplay: game.settings.get(C.ID, "monkCommonDisplay"),
            leftName: (_sideMainName ? data.activeSpeakers.left[0]?.name : settingData.slidersText?.left?.[0]) || "",
            leftTitle: (_sideMainName ? data.activeSpeakers.left[0]?.title : settingData.slidersText?.left?.[1]) || "",
            rightName: (_sideMainName ? data.activeSpeakers.right[data.activeSpeakers.right?.length - 1]?.name : settingData.slidersText?.right?.[0]) || "",
            rightTitle: (_sideMainName ? data.activeSpeakers.right[data.activeSpeakers.right?.length - 1]?.title : settingData.slidersText?.right?.[1]) || "",
            timeNumbers: getTime(true, settingData).split("")
        }

        const slidersSet = SlidersSetClass.getActiveSet()

        const slidersClass = document.getElementById("vn-up")?.className || "vn-hidden-slide"
        const backElClass = document.getElementById('vn-background')?.className || "vn-hidden-fade"
        const editWindowClass = document.getElementById('vn-edit-window')?.className || "vn-hidden-fade"

        const headerFont = game.settings.get(C.ID, "fontFamily")
        const css = {
            slidersClass: !_addData.showVN || data.hideUI
                ? (slidersClass.includes("vn-hidden") ? "vn-hidden" : "vn-hidden-slide")
                : (slidersClass.includes("vn-shown") ? "vn-shown" : "vn-shown-slide"),
            bodyClass: !_addData.showVN
                ? (backElClass.includes("vn-hidden") ? "vn-hidden" : "vn-hidden-fade") // (backElClass == "vn-hidden-fade" ? "vn-hidden" : "vn-hidden-fade")
                : (backElClass.includes("vn-shown") ? "vn-shown" : "vn-shown-fade"), // (backElClass == "vn-shown-fade" ? "vn-shown" : "vn-shown-fade"),
            editWindowWidth: 25 + (Math.max(uiData.slotCount.left, uiData.slotCount.right) - 3) * 2 + "%",
            editWindowClass: data.editMode ? (settingData.showVN && !data.hideUI && !game.user.getFlag(C.ID, "hideVN")
                ? `${(editWindowClass.includes("vn-shown") ? "vn-shown" : "vn-shown-fade")} vn-pointer`
                : editWindowClass.includes("vn-hidden") ? "vn-hidden" : "vn-hidden-fade") : "vn-hidden",
            pFieldClass: settingData.editMode && settingData.showVN && game.user.isGM ? "" : "vn-hidden",
            // ...getFontsSize(headerFont, data.locationName, data.parentLocation),
            headerFont: headerFont,
            slidersSet: slidersSet,
            playerListGlow: settingData.showForIds ? " vn-glow" : "",
            zIndex: game.settings.get(C.ID, "zIndex") || 90
            // buttonsIcons: uiButtonsIcons
        }


        return {
            ...data, ..._addData, ...css,
            isGM: game.user.isGM,
            editActorData: editActorData,
            shownElements: shownElements, ...uiData
        };
    }

    // Активация интерфейса при запуске Foundry (./settings.js)
    static activate() {
        this.instance = new VisualNovelDialogues();
        this.instance?.render(true);
    }

    // Показать/скрыть интерфейс
    static async turnVN(showForIds = null) {
        // ..(showForIds = "notChange")..
        const settings = getSettings()
        const forcedOpen = game.settings.get(C.ID, "permaForcedOpen")
        if (allowTo("displayControl")) {

            if (forcedOpen) {
                for (const user of game.users) {
                    await user.setFlag(C.ID, "hideVN", false)
                }
            }

            settings.showVN = !settings.showVN
            settings.showForIds = showForIds

            // if (showForIds != "notChange") settings.showForIds = showForIds

            await requestSettingsUpdate(settings, {change: ["showVN"]})
        } else {
            const hideVN = game.user.getFlag(C.ID, "hideVN") || false;
            ui.notifications.info(game.i18n.localize(forcedOpen
                ? `${C.ID}.settings.${!hideVN ? "hideVN" : "dontHideVN"}`
                : `${C.ID}.settings.hiveVNforNow`
            ));
            await game.user.setFlag(C.ID, "hideVN", !hideVN);
            VisualNovelDialogues.instance.render(true);
        }

        // Окошко о новой настройке
        if (game.user.isGM && settings.showVN && game.settings.get(C.ID, "showNewThingyDialog")) {
            new Dialog({
                title: game.i18n.localize(`${C.ID}.newThingy.title`),
                content: `<p>${game.i18n.localize(`${C.ID}.newThingy.content`)}</p>`,
                buttons: {
                    dontShowAgain: {
                        label: game.i18n.localize(`${C.ID}.newThingy.dontShowAgain`),
                        callback: async () => {
                            await game.settings.set(C.ID, "showNewThingyDialog", false)
                        }
                    },
                    ok: {
                        label: game.i18n.localize(`${C.ID}.newThingy.ok`),
                        callback: () => {}
                    }
                },
                default: "ok"
            }).render(true)
        }
    }

    static renderForAll() {
        VisualNovelDialogues.instance.render(true);
        game.socket.emit(`module.${C.ID}`, {type: 'renderForAll'});
    }

    // Активация слушателей
    activateListeners(html) {
        super.activateListeners(html);
        const permSettings = deepClone(game.settings.get(C.ID, "playersPermissions"))
        /* ——— Вспомогательные (больше квадратные) кнопки, начало —— */
        // - Показать/скрыть интерфейс
        document.getElementById('vn-hide-button')?.addEventListener('click', async (event) => {
            await VisualNovelDialogues.turnVN();
        })
        // - Открыть лист персонажа
        document.getElementById('vn-actor-button')?.addEventListener('click', async (event) => {
            const sheet = game.user.character?.sheet
            if (sheet) {
                sheet.render(true)
            } else {
                ui.notifications.info(game.i18n.localize(`${C.ID}.errors.noSheet`))
            }
        })
        // - Скрыть интерфейс VN
        function localHideUI(hideUI) {
            const settingData = getSettings()
            document.getElementById('vn-unhideUI-button').style.display = hideUI ? "grid" : "none"
            const editWindowEl = document.getElementById('vn-edit-window')
            if (editWindowEl) editWindowEl.className = settingData.editMode ? (settingData.showVN && !hideUI && !game.user.getFlag(C.ID, "hideVN") ? "vn-shown-fade vn-pointer" : "vn-hidden-fade") : "vn-hidden"
            document.querySelector('.vn-buttons-container').style.display = hideUI ? "none" : "contents"
            const slidersEl = [document.getElementById('vn-up'), document.getElementById('vn-left'), document.getElementById('vn-right')]
            slidersEl.forEach(el => {
                el.classList.toggle('vn-hidden-slide', hideUI)
                el.classList.toggle('vn-shown-slide', !hideUI)
            })
        }
        document.getElementById('vn-hideUI-button')?.addEventListener('click', async (event) => {
            if (game.user.isGM) {
                const settings = getSettings()
                settings.hideUI = true
                await requestSettingsUpdate(settings, {change: ["hideUI"]})
            } else {
                localHideUI(true)
            }
        })
        // - Раскрыть интерфейс VN
        document.getElementById('vn-unhideUI-button')?.addEventListener('click', async (event) => {
            if (game.user.isGM) {
                const settings = getSettings()
                settings.hideUI = false
                await requestSettingsUpdate(settings, {change: ["hideUI"]})
            } else {
                localHideUI(false)
            }
        })
        // - Селектор
        const selectorEl = document.getElementById('vn-selector-open')
        selectorEl?.addEventListener('click', async () => {
            const selectorOpen = !game.user.getFlag(C.ID, "selectorOpen")
            selectorEl.querySelector('i').className = `fa-solid fa-${selectorOpen ? "caret-right" : "caret-left"} vn-icon-button`
            html.find('.vn-selector-body')[0].style.display = selectorOpen ? "flex" : "none"
            await game.user.setFlag(C.ID, "selectorOpen", selectorOpen)
        })
        html[0].querySelectorAll('.vn-selector-item')?.forEach((el) => {
            el.addEventListener('click', async (event) => {
                event.preventDefault();
                // I know this is so fucking wrong, I just want to end this
                const _type = {"ChatMessages": "chat","Combats": "combat","Scenes": "scenes","Actors": "actors","Items": "items","JournalEntries": "journal","RollTables": "tables","CardsPlural": "cards","Playlists": "playlists","TabCompendium": "compendium","Settings": "settings"}
                const tabApp = ui[_type[event.currentTarget.dataset.type]];
                if (!tabApp) return;
                tabApp.renderPopout(tabApp);
            })
        })
        // - Список активных игроков, скрыть/раскрыть
        const playerListEl = document.getElementById('vn-player-list-open')
        playerListEl?.addEventListener('click', async () => {
            const playerListOpen = !game.user.getFlag(C.ID, "playerListOpen")
            playerListEl.querySelector('i').className = `fa-solid fa-${playerListOpen ? "caret-right" : "caret-left"} vn-icon-button`
            html.find('.vn-player-list-body')[0].style.display = playerListOpen ? "flex" : "none"
            await game.user.setFlag(C.ID, "playerListOpen", playerListOpen)
        })
        // - Список активных игроков, "раскрыть для всех"
        document.getElementById("vn-player-list-body")?.querySelector('.vn-player-list-showForAll')?.addEventListener('click', async (event) => {
            if (!allowTo('displayControl', permSettings)) return
            const settings = getSettings()
            settings.showForIds = game.users.map(user => user.id)
            await requestSettingsUpdate(settings, {change: ["changeVisibility"]})
        })
        // - Список активных игроков - ПКМ на игрока открывает мини-окошко

        document.getElementById("vn-player-list-body")?.querySelectorAll('li')?.forEach(playerListItem => {
            playerListItem.addEventListener('contextmenu', async (event) => {
                if (!allowTo('displayControl', permSettings)) return
                contextMenuListener(event.currentTarget)
            })
        })
        /* ——— Вспомогательные (больше квадратные) кнопки, конец —— */

        /* ——— Активные (круглые маленькие) кнопки, начало ——— */
        // - Сменить фон
        document.getElementById('vn-background-button')?.addEventListener('click', async (event) => {
            if (!allowTo('locationChanges', permSettings)) return
            new FilePicker({classes: ["filepicker"], current: C.portraitFoldersPath(), type: "image", displayMode: "thumbs", callback: async (image) => {
                    if (image) {
                        const settingData = getSettings()
                        const location = getLocation(settingData)
                        location.forEach(m => m.backgroundImage = image);
                        await requestSettingsUpdate(settingData, {change: ["backgroundImage"], img: image})
                    };
                }}).render();
        })
        // - Открыть меню настроек
        document.getElementById('vn-settings-menu')?.addEventListener('click', async (event) => {
            new VisualSettingsMenu().render(true)
        })
        // - Переключить режим редактирования
        document.getElementById('vn-editMode-button')?.addEventListener('click', async (event) => {
            if (!allowTo('editWindow', permSettings)) return
            const settingData = getSettings()
            settingData.editMode = !settingData.editMode;
            await requestSettingsUpdate(settingData, {change: ["editMode"]})
        })
        // - Переключение режима связи изменений локаций
        document.getElementById('vn-linkChanges-button')?.addEventListener('click', async () => {
            if (!allowTo('locationChanges', permSettings)) return
            const settingData = getSettings()
            settingData.linkChanges = !settingData.linkChanges;
            await requestSettingsUpdate(settingData, {change: ["linkChanges"]})
        })
        // - Откат изменений локации
        document.getElementById('vn-backup-button')?.addEventListener('click', async () => {
            if (!allowTo('locationChanges', permSettings)) return
            const settingData = getSettings()
            const originalLocation = settingData.locationList.find(m => m.id == settingData.location.id);
            if (originalLocation) {
                settingData.location = originalLocation;
                await requestSettingsUpdate(settingData, {change: ["changeLocation"]})
            } else {
                ui.notifications.error(game.i18n.localize(`${C.ID}.errors.noOriginalLocation`));
            }
        })
        // - Переключение отображение фона
        document.getElementById('vn-hideBack-button')?.addEventListener('click', async () => {
            if (game.user.isGM) {
                const settingData = getSettings()
                settingData.hideBack = !settingData.hideBack;
                await requestSettingsUpdate(settingData, {change: ["hideBack"]})
            } else {
                const hideBackButtonIEl = document.getElementById('vn-hideBack-button')?.querySelector('i')

                const _hidden = hideBackButtonIEl.style["font-weight"] == "800"

                document.getElementById('vn-background-image').classList.toggle('vn-hidden', _hidden)
                document.getElementById("vn-background-shadow").classList.toggle('vn-hidden', _hidden)
                document.getElementById("vn-background").style["pointer-events"] = _hidden ? "none" : null
                hideBackButtonIEl.style["font-weight"] = _hidden ? "300" : "800"
            }
        })
        // - Открыть окно Epic Rolls
        document.getElementById('vn-epicRoll-button')?.addEventListener('click', async () => {
            if (!game.user.isGM) return
            if (!game.modules.get("epic-rolls-5e")?.active) return
            const epicRollButton = document.getElementById('chat-controls')?.querySelector('.epic-roll-chat-control')
            if (epicRollButton) {
                epicRollButton.click()
            }
        })
        // - Окно спецэфектов
        document.getElementById('vn-effects-button')?.addEventListener('click', async () => {
            if (!game.user.isGM) return
            ui.notifications.info("WIP")
        })
        // - Справка об использовании модуля
        document.getElementById('vn-hint-button')?.addEventListener('click', async () => {
            new Dialog({
                title: game.i18n.localize(`${C.ID}.dialogues.globalGuideTitle`),
                content: game.settings.get(C.ID, "globalGuideLocalization")[game.i18n.lang] || game.settings.get(C.ID, "globalGuideLocalization").en,
                buttons: {
                },
            }).render(true, {width: window.innerWidth*0.70, height: window.innerHeight*0.90})
        })
        /* ——— Активные (круглые маленькие) кнопки, конец ——— */

        /* ——— Окно EditMode, начало ——— */
        // - Раздел "Портрет"
        // -- Открыть окно ActorPicker
        document.getElementById('vn-addActor-button')?.addEventListener('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            ActorPicker.open();
        });
        // -- Открыть окно LocationPicker
        document.getElementById('vn-locationPicker-button')?.addEventListener('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            LocationPicker.open();
        })
        // -- Открыть окно - подсказку по окну редактирования
        document.getElementById('vn-ewInfo-button')?.addEventListener('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            new Dialog({
                title: game.i18n.localize(`${C.ID}.dialogues.editWindowTitle`),
                content: game.i18n.localize(`${C.ID}.dialogues.editWindowHint`),
                buttons: {
                },
            }).render(true)
        })
        // -- Закрыть окно редактирования (переключить режим редактирования)
        document.getElementById('vn-ewClose-button')?.addEventListener('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            const settingData = getSettings()
            settingData.editMode = false;
            await requestSettingsUpdate(settingData, {change: ["editMode"]})
        })
        // -- Выбор активного портрета при клике ЛКМ
        html.find('.vn-ew-slot').on('click', async (event) => {
            if (!allowTo("editWindow", permSettings)) return
            const settingData = getSettings()
            const pos = event.currentTarget.dataset.pos
            const portraitData = settingData.activeSpeakers[pos]
            let _change = {}
            // Активный портрет на соответствующей стороне только выбранный
            if (event.ctrlKey) {
                const posSide = pos.split(/(?=[A-Z])/)[0]
                settingData.activeSlots[posSide] = [pos]
                settingData.slidersText[posSide][0] = portraitData?.name
                settingData.slidersText[posSide][1] = portraitData?.title
                _change = {change: ["editActiveSlots"], slotSide: posSide}
                // Переключение "активности" выбранного портрета
            } else if (event.shiftKey) {
                const posSide = pos.split(/(?=[A-Z])/)[0]
                if (settingData.activeSlots[posSide].includes(pos)) {
                    const _sidePortraitData = settingData.activeSpeakers[posSide+'First']
                    settingData.slidersText[posSide][0] = _sidePortraitData?.name
                    settingData.slidersText[posSide][1] = _sidePortraitData?.title
                    settingData.activeSlots[posSide] = settingData.activeSlots[posSide].filter(slot => slot !== pos)
                } else {
                    settingData.slidersText[posSide][0] = portraitData?.name
                    settingData.slidersText[posSide][1] = portraitData?.title
                    settingData.activeSlots[posSide].push(pos)
                }
                _change = {change: ["editActiveSlots"], slotSide: posSide}
            } else {
                settingData.editActiveSpeaker = pos
                _change = {change: ["editActiveSpeaker"], value: pos}
            }
            await requestSettingsUpdate(settingData, _change)
        })
        // -- Удаление портрета при клике ПКМ
        html.find('.vn-ew-slot').on('contextmenu', async (event) => {
            if (!allowTo("editWindow", permSettings)) return
            if (!event.currentTarget.querySelector('img').dataset.id) return
            const settingData = getSettings()
            const pos = event.currentTarget.dataset.pos
            settingData.activeSpeakers[pos] = null
            await requestSettingsUpdate(settingData, {change: ["editPortrait"], positions: [pos]})
        })
        // - подсвечивание полей ввода при изменении
        html.find('.vn-edit-name, .vn-edit-title').on('change', function() {
            $(this).addClass('vn-hlight');
        });
        // - Изменение масштаба
        html.find('input[name="scale"]').on('input', function(event) {
            $(this).addClass('vn-hlight');
            const actorEl = getActorEl();
            actorEl.style.transform = `scale(${event.currentTarget.value}%)`;
            const counterEl = html.find('.range-scale-value');
            counterEl.text(`${event.currentTarget.value}%`);
        })
        // - Перемещение портрета по оси X
        html.find('input[name="coordX"]').on('input', function(event) {
            $(this).addClass('vn-hlight');
            const settingData = getSettings();
            const actorEl = getActorEl();
            actorEl.style.left = `${event.currentTarget.value*(settingData.editActiveSpeaker.includes("left") ? -1 : 1)}px`;
            const counterEl = html.find(`.range-coordX-value`);
            counterEl.text(event.currentTarget.value);
        })
        // - Перемещение портрета по оси Y
        html.find('input[name="coordY"]').on('input', function(event) {
            $(this).addClass('vn-hlight');
            const actorEl = getActorEl();
            actorEl.style.top = `${(event.currentTarget.value*-1) - game.settings.get(C.ID, "worldOffsetY")}px`;
            const counterEl = html.find(`.range-coordY-value`);
            counterEl.text(event.currentTarget.value);
        })
        // - Дополнительные настройки
        // -- Отразить портрет по оси X
        html.find('input[name="mirrorX"]').on('change', function(event) {
            if (!allowTo("editWindow", permSettings)) return
            event.target.parentElement.classList.add('vn-hlight');
            const settingData = getSettings();
            const actorBodyEl = document.querySelector(`.vn-portrait.${settingData.editActiveSpeaker}`)
            if (!actorBodyEl) return
            actorBodyEl.style.transform = actorBodyEl.style.transform.replace(/-?1/, match => match === "1" ? "-1" : "1")
        })
        // -- Ширина портрета = ширине рамки
        html.find('input[name="widthEqualFrame"]').on('change', function(event) {
            if (!allowTo("editWindow", permSettings)) return
            event.target.parentElement.classList.add('vn-hlight');
            const settingData = getSettings();
            const actorBodyEl = document.querySelector(`.vn-portrait.${settingData.editActiveSpeaker}`)
            if (!actorBodyEl) return
            if (event.target.checked) {
                actorBodyEl.style.width = "100%"
                actorBodyEl.style.height = "auto"
            } else {
                actorBodyEl.style.removeProperty('width')
                actorBodyEl.style.removeProperty('height')
            }
        })
        // - Сохранение изменений при нажатии кнопки "Применить"
        html.find('.vn-edit-apply').on('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            let settingData = getSettings();
            const portraitData = settingData.activeSpeakers[settingData.editActiveSpeaker]
            if (!portraitData) {
                ui.notifications.warn(game.i18n.localize(`${C.ID}.errors.noPortrait`));
                return
            }
            const leftCheck = settingData.editActiveSpeaker.includes("left")
            // Имя и титул
            portraitData.name = html[0].querySelector('.vn-edit-name').value;
            portraitData.title = html[0].querySelector('.vn-edit-title').value;
            // Масштаб и смещение
            portraitData.scale = parseInt(document.getElementById('vn-edit-scale').value);
            portraitData[leftCheck ? "offsetXl" : "offsetXr"] = parseInt(document.getElementById('vn-edit-offsetX').value)*(leftCheck ? -1 : 1);
            portraitData.offsetY = parseInt(document.getElementById('vn-edit-offsetY').value)*-1;
            // Дополнительные настройки
            portraitData.mirrorX = html[0].querySelector('input[name="mirrorX"]').checked
            portraitData.widthEqualFrame = html[0].querySelector('input[name="widthEqualFrame"]').checked

            settingData.activeSpeakers[settingData.editActiveSpeaker] = portraitData
            settingData = await updatePortrait(portraitData.id, portraitData, settingData, true)
            await requestSettingsUpdate(settingData, {change: ["editPortrait"], positions: [settingData.editActiveSpeaker]})
        })
        // - Отмена изменений при нажатии кнопки "Отмена"
        html.find('.vn-edit-cancel').on('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            editWindowActorUpdate()
        })
        // - Обнуление настроек портрета
        html.find('.vn-edit-zeroSettings').on('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            html.find('input[name="scale"]').val(100).trigger('input')
            html.find('input[name="coordX"]').val(0).trigger('input')
            html.find('input[name="coordY"]').val(0).trigger('input')
        })
        // - Удаление портрета при нажатии на кнопку
        html.find('.vn-edit-deleteActor').on('click', async () => {
            if (!allowTo("editWindow", permSettings)) return
            const settingData = getSettings()
            settingData.activeSpeakers[settingData.editActiveSpeaker] = null
            await requestSettingsUpdate(settingData, {change: ["editPortrait"], positions: [settingData.editActiveSpeaker]})
        })
        /* ——— Окно EditMode, конец ——— */

        /* ——— Header, начало ——— */
        // Основная локация, ЛКМ - открыть LocationPicker
        document.getElementById('vn-current-location-body')?.addEventListener('click', async () => {
            if (!allowTo('locationChanges', permSettings)) return
            LocationPicker.open()
        })
        // Родительская локация, ЛКМ - открыть LocationPicker с фильтром по род. локации
        document.getElementById('vn-parent-location-body')?.addEventListener('click', async () => {
            if (!allowTo('locationChanges', permSettings)) return
            LocationPicker.open("parent", `${getSettings().location?.parentLocation || ""}`)
        })
        // ПКМ по названию локации/родительской локации - окно редактирования локации
        document.getElementById('vn-current-location-body')?.addEventListener('contextmenu', async (event) => {
            if (!allowTo('locationChanges', permSettings)) return
            const editableLocation = getSettings().location
            const textureSize = await getTextureSize(editableLocation?.backgroundImage)
            // if (game.user.isGM) new LocationPickerSettings({...editableLocation, ...textureSize}, true).render(true)
            LocationPickerSettings.open("current")
        })
        // document.getElementById('vn-parent-location-body')?.addEventListener('contextmenu', async (event) => {
        //     const textureSize = await getTextureSize(editableLocation?.backgroundImage)
        //     // if (game.user.isGM) new LocationPickerSettings({...editableLocation, ...textureSize}, false).render(true)
        //     if (game.user.isGM) new LocationPickerSettings({...editableLocation, ...textureSize}, false).render(true)
        // })
        // Время - изменить видимость / открыть календарь
        document.getElementById('vn-time')?.addEventListener('click', async (event) => {
            if (!["vn-clock", "vn-time-body"].some(s => event.target.classList.contains(s))) return
            const settings = getSettings();
            // - При выключенном editMode - открываем календарь
            if (!settings.editMode) {
                if (game.modules.get('foundryvtt-simple-calendar')?.active) SimpleCalendar.api.showCalendar()
                // - При включенном editMode - переключаем отображение времени на локации
            } else {
                if (!allowTo('locationSubChanges', permSettings)) return
                const location = settings.location
                location.knowTime = !location.knowTime
                // - При включенном linkChanges - переключаем отображение времени И НА ОРИГИНАЛЬНОЙ ЛОКАЦИИ тоже
                if (settings.linkChanges) {
                    settings.locationList.find(m => m.id == location.id).knowTime = location.knowTime
                }
                await requestSettingsUpdate(settings, {change: ["knowTime"], value: !settings.knowTime})
            }
        });
        // Время - раскрыть/скрыть менюшку изменения времени
        const clockDropdownEl = document.getElementById('vn-clock-dropdown');
        document.getElementById('vn-time')?.addEventListener('contextmenu', async () => {
            if (!allowTo('locationSubChanges', permSettings)) return
            const settings = getSettings();
            if (!settings.editMode) return
            clockDropdownEl.style.display = clockDropdownEl.style.display == 'flex' ? "none" : 'flex';
            // ДОБАВИТЬ СЛУШАТЕЛЬ НА СОКРЫТИЕ ЭЛЕМЕНТА
        })
        // Время - +1/-1 к цифрам
        const clockButtons = document.getElementById('vn-clock-dropdown')?.querySelectorAll('.vn-clock-button');
        clockButtons?.forEach(button => {
            button.addEventListener('click', async (event) => {
                const numEls = Array.from(document.getElementById("vn-time")?.querySelectorAll('.vn-clock-number'))
                const index = event.currentTarget.dataset.index;
                const maxValues = [2, 9, ":", 5, 9];
                const minValues = [0, 0, ":", 0, 0];
                const timeArray = numEls.map(el => el.textContent);
                let currentDigit = parseInt(timeArray[index]);
                if (timeArray[0] === '2') {
                    maxValues[1] = 3; // Если первая цифра часа 2, то вторая цифра может быть максимум 3
                }

                if (event.currentTarget.dataset.type == "plus") {
                    currentDigit = (currentDigit + 1) > maxValues[index] ? minValues[index] : currentDigit + 1;
                } else {
                    currentDigit = (currentDigit - 1) < minValues[index] ? maxValues[index] : currentDigit - 1;
                }
                const numEl = event.currentTarget.parentElement.querySelector('span');
                numEl.textContent = currentDigit
            })
        })
        // Время - применить
        html[0].querySelector('.vn-clock-confirm-button')?.addEventListener('click', async () => {
            if (!allowTo('locationSubChanges', permSettings)) return
            const settings = getSettings();
            clockDropdownEl.style.display = 'none';

            const numEls = document.querySelectorAll('.vn-clock-number');
            const time = Array.from(numEls).reduce((a, b) => a + b.textContent, "") || "12:30"

            if (useSimpleCalendar()) {
                const timeObj = SimpleCalendar.api.currentDateTime()
                timeObj.hour = parseInt(time.split(":")[0])
                timeObj.minute = parseInt(time.split(":")[1])
                SimpleCalendar.api.setDate(timeObj)
            } else {
                settings.clockTime = time
                await requestSettingsUpdate(settings, {change: ["clockTime"]})
            }
        })
        // Время - сброс
        html[0].querySelector('.vn-clock-reset-button')?.addEventListener('click', () => {
            if (!allowTo('locationSubChanges', permSettings)) return
            const clockEl = document.getElementById('vn-time')?.querySelector("span");
            clockDropdownEl.style.display = 'none';
            const time = getTime()
            clockEl.textContent = time

            const numEls = document.querySelectorAll('.vn-clock-number');
            numEls.forEach((el, i) => {
                el.textContent = time[i]
            })
        })
        // Погода
        const dropdown = html[0].querySelector('.vn-weather-dropdown');
        document.getElementById('vn-weather')?.addEventListener('click', (element) => {
            if (!getSettings().editMode || !allowTo('locationSubChanges', permSettings)) return
            dropdown.style.display = dropdown.style.display == 'none' ? 'block' : 'none';
        });
        html[0].querySelectorAll('.vn-weather-option').forEach(option => {
            addWeatherListener(option, dropdown);
        });

        // Скрыть всплывающий список погоды и времени

        html[0]?.addEventListener('click', (event) => {
            // Погода
            if (dropdown && !dropdown.contains(event.target) && !document.getElementById('vn-weather').contains(event.target)) {
                dropdown.style.display = 'none';
            }
            // Время
            if (clockDropdownEl && !clockDropdownEl.contains(event.target)) {
                clockDropdownEl.style.display = 'none';
            }
        });
        // Температура
        // - Изменение (локально)
        html.find('input[name="temperature"]').on('input', function(event) {
            const color = _getTemperatureColor(parseInt(event.currentTarget.value));
            const thermometerEl = html.find('.vn-thermometer');
            thermometerEl[0].style.color = color;
            const tooltipEl = document.getElementById('tooltip')
            if (tooltipEl.textContent.search(/[0-9]+°C/) != -1) tooltipEl.textContent = `${event.currentTarget.value}°C`;
        })
        // - Изменение (глобально)
        html.find('input[name="temperature"]').on('change', async function(event) {
            if (!allowTo('locationSubChanges', permSettings)) return
            const settingData = getSettings();
            const location = getLocation(settingData)
            const color = _getTemperatureColor(parseInt(event.currentTarget.value));
            location.forEach(m => {
                m.temperature = parseInt(event.currentTarget.value)
                m.temperatureColor = color
            })
            await requestSettingsUpdate(settingData, {change: ["temperature"], value: event.currentTarget.value})
        });
        // - Неактивная очередь: ПКМ на ячейку удаляет её из очереди
        html.find('.vn-mo-item')?.on('contextmenu', async (event) => {
            if (!allowTo('miniOrder', permSettings)) return
            const _side = event.currentTarget.dataset.side
            const _id = event.currentTarget.dataset.id
            if (!_id) return
            const settings = getSettings()
            settings.order[_side] = settings.order[_side].filter(el => el.id !== _id)
            await requestSettingsUpdate(settings, {change: ["editOrder"], side: [_side]})
        })
        /* ——— Header, конец ——— */

        /* ——— Заявки, начало ——— */
        async function request(level) {
            if (!allowTo('requests', permSettings)) return;

            let img, id, name;
            const character = game.user.character;
            const defaultImage = "modules/visual-novel-dialogues/assets/default-request.png"; // Define a default image in your module

            if (character) {
                // Use character token image if available
                img = character.prototypeToken?.texture?.src;
                id = character.id;
                name = character.name || game.user.name;
                if (!img || img === "icons/svg/mystery-man.webp") {
                    img = game.user.avatar; // Fallback to user avatar if token image is missing or default
                }
            } else {
                // Fallback to user data if no character is selected
                img = game.user.avatar;
                id = game.user.id;
                name = game.user.name;
            }

            // Final fallback to default image if no valid image is found
            if (!img || img === "icons/svg/mystery-man.webp") {
                if (game.user.isGM) {
                    img = defaultImage; // GMs use default image to avoid blocking
                } else {
                    ui.notifications.error(game.i18n.localize(`${C.ID}.errors.noImageAvailable`));
                    return;
                }
            }

            // Debug logging to diagnose image issues
            console.log("Request Debug:", { character: !!character, img, id, name, userAvatar: game.user.avatar, tokenSrc: character?.prototypeToken?.texture?.src });

            let settingData = getSettings();
            settingData.effects.requests[id] = {
                level: level,
                img: img,
                name: name
            };
            const options = { change: ["requestAdd"], requestId: id };
            // Автоматическое назначение в слоты для заявок
            if (game.settings.get(C.ID, "autoAssignSlots")) {
                const isPlayer = character && Object.keys(character.ownership).some(userId => {
                    const user = game.users.get(userId);
                    return user && !user.isGM && character.ownership[userId] >= 3;
                });
                const slot = isPlayer ? "leftFirst" : "rightFirst";
                if (!settingData.activeSpeakers[slot] || !settingData.activeSpeakers[slot].id) {
                    settingData.activeSpeakers[slot] = {
                        id: id,
                        img: img,
                        name: name,
                        title: "",
                        offsetX: 0,
                        offsetY: 0,
                        scale: 100,
                        mirrorX: false,
                        widthEqualFrame: game.settings.get(C.ID, "worldWidthEqualFrame")
                    };
                    options.change.push("editActiveSpeakers");
                }
            }
            await requestSettingsUpdate(settingData, options);
        }

// Добавляем обработчики на кнопки
        document.getElementById("vn-request-first-button")?.addEventListener('click', async () => {
            await request(1);
        });
        document.getElementById("vn-request-second-button")?.addEventListener('click', async () => {
            await request(2);
        });
        document.getElementById("vn-request-third-button")?.addEventListener('click', async () => {
            await request(3);
        });
        const requests = html[0].querySelectorAll('.vn-request-container');
        if (requests && requests.length > 0) {
            requests.forEach(request => {
                addRequestListener(request, "click");
                addRequestListener(request, "contextmenu");
            });
        }
        /* ——— Заявки, конец ——— */

        /* ——— Дополнительно, начало ——— */
        // - Нажатие ЛКМ на портрет:
        // -- если нажимает GM или нажимает игрок на свой портрет - переносит его в активный слот на соответствующей стороне
        // -- в ином случае - меняет его местами со своим портретом
        function swapPortraitListener(elements, side) {
            elements.forEach(element => {
                element?.addEventListener('click', async (event) => {
                    if (!allowTo('portraitInteraction', permSettings)) return
                    const settings = getSettings()
                    const pos = event.target.parentElement.dataset.pos
                    if (!pos) return
                    if (game.user.isGM || event.target?.parentElement?.dataset?.id == game.user.character?.id) {
                        if (pos.includes("First")) return
                        const portraitData = settings.activeSpeakers[pos]
                        if (!portraitData) return
                        const _toSwapData = settings.activeSpeakers[`${side}First`] // буфер
                        settings.activeSpeakers[`${side}First`] = portraitData
                        settings.activeSpeakers[pos] = _toSwapData

                        const options = {change: ["editPortrait"], positions: [`${side}First`, pos]}
                        await requestSettingsUpdate(settings, options)
                    } else {
                        const myPos = Object.keys(settings.activeSpeakers).find(_pos => {
                            if (settings.activeSpeakers[_pos]?.id === game.user.character?.id) return _pos;
                        });
                        if (!myPos) return
                        const _toSwapData = settings.activeSpeakers[pos]
                        settings.activeSpeakers[pos] = settings.activeSpeakers[myPos]
                        settings.activeSpeakers[myPos] = _toSwapData

                        const options = {change: ["editPortrait"], positions: [pos, myPos]}
                        await requestSettingsUpdate(settings, options)
                    }
                })
            })
        }
        const backPotraitLeftEls = html[0].querySelectorAll('.vn-pField-left')
        const backPotraitRightEls = html[0].querySelectorAll('.vn-pField-right')
        swapPortraitListener(backPotraitLeftEls, "left")
        swapPortraitListener(backPotraitRightEls, "right")
        // Нажатие ПКМ на портрет переносит его в мини-очередь под верхушкой
        function moveToOrder(elements, side) {
            elements.forEach(element => {
                element?.addEventListener('contextmenu', async (event) => {
                    if (!allowTo("miniOrder", permSettings)) return
                    const pos = event.target.parentElement.dataset.pos
                    const settings = getSettings()
                    const portraitData = deepClone(settings.activeSpeakers[pos])
                    settings.activeSpeakers[pos] = null
                    let options = {change: ["editPortrait"], positions: [pos]}
                    const _id = event.target.parentElement.dataset.id
                    if (portraitData && !settings.order[side].some(item => item.id === _id)) {
                        settings.order[side].push({
                            id: _id,
                            img: portraitData.img,
                            name: `${portraitData.name}${portraitData.title ? `, ${portraitData.title}` : ""}`,
                        })
                        if (settings.order[side].length > 6) settings.order[side].shift()
                        options = {change: ["editPortrait", "editOrder"], positions: [pos], side: [side]}
                    }
                    await requestSettingsUpdate(settings, options)
                })
            })
        }
        moveToOrder(backPotraitLeftEls, "left")
        moveToOrder(backPotraitRightEls, "right")
        // - Наведение на портрет выводит его имя на плашку
        let timeoutId;
        [...backPotraitLeftEls, ...backPotraitRightEls].forEach(activeElement => {
            const _isLeft = activeElement.parentElement.dataset.pos.includes("left")
            const textParEl = _isLeft ? document.getElementById(`vn-left-text`) : document.getElementById(`vn-right-text`)
            activeElement.addEventListener('mouseover', function() {
                timeoutId = setTimeout(function() {
                    const portraitData = getPortrait(activeElement.parentElement.dataset.id)
                    if (portraitData && portraitData.name) {
                        textParEl.querySelector(`.vn-name`).textContent = portraitData.name
                        textParEl.querySelector(`.vn-title`).textContent = portraitData.title || ""
                    }
                    clearTimeout(timeoutId);
                }, 750);
            });
            activeElement.addEventListener('mouseout', function() {
                const settingData = getSettings()
                const _sideMainName = game.settings.get(C.ID, "sideMainName")
                const _text = {
                    leftName: (_sideMainName ? settingData.activeSpeakers["leftFirst"]?.name : settingData.slidersText.left[0]) || "",
                    leftTitle: (_sideMainName ? settingData.activeSpeakers["leftFirst"]?.title : settingData.slidersText.left[1]) || "",
                    rightName: (_sideMainName ? settingData.activeSpeakers["rightFirst"]?.name : settingData.slidersText.right[0]) || "",
                    rightTitle: (_sideMainName ? settingData.activeSpeakers["rightFirst"]?.title : settingData.slidersText.right[1]) || "",
                }
                textParEl.querySelector(`.vn-name`).textContent = _isLeft ? _text.leftName : _text.rightName
                textParEl.querySelector(`.vn-title`).textContent = _isLeft ? _text.leftTitle : _text.rightTitle || ""
                clearTimeout(timeoutId);
            });
        })
        // Наведение на кнопку переключения оторажения списка игроков убирает подсветку (если была)
        document.getElementById(`vn-player-list-open`)?.addEventListener('mouseover', (event) => {
            event.target.classList.remove("vn-glow")
        })
        /* ——— Дополнительно, конец ——— */
    }

    _canDragDrop(event) {
        return true;
    }

    _canDragStart(event) {
        return true;
    }

    // Перетягивание (замена) портретов в окне редактирования
    _onDragStart(event) {
        const img = $(event.currentTarget);
        const actorId = img[0].dataset.id
        if (!actorId) return false
        const actorFlags = getPortrait(actorId)
        let transferData = [actorFlags, img[0].dataset.pos]
        if (img[0].classList.contains("vn-mo-item")) {
            transferData.push({id: actorId, side: img[0].dataset.side})
        }
        if (actorFlags) event.dataTransfer.setData("text/plain", JSON.stringify(transferData));
    }

    async _onDrop(event) {
        const actorData = event.dataTransfer.getData('text/plain');
        if (!actorData || actorData === "") return
        const transferData = JSON.parse(actorData)
        const settings = getSettings()

        // Добавление нового персонажа (портрета) через ActorPicker (../app/actorPicker.js)
        if (event.target?.classList?.contains("vn-pField")) {
            const position = event.target.parentElement.dataset.pos
            const currentSpeaker = settings.activeSpeakers[position]
            settings.activeSpeakers[position] = transferData[0]
            let options = {change: ["editPortrait"], positions: [position]}
            // Если переносим из мини-очереди сверху - удаляем портрет из мини-очереди
            if (transferData[2]) {
                const _side = transferData[2].side
                const _id = transferData[2].id
                if (currentSpeaker) {
                    settings.order[_side][settings.order[_side].findIndex(el => el.id === _id)] = {
                        id: currentSpeaker.id,
                        img: currentSpeaker.img,
                        name: `${currentSpeaker.name}${currentSpeaker.title ? `, ${currentSpeaker.title}` : ""}`,
                    }
                } else {
                    settings.order[_side] = settings.order[_side].filter(el => el.id !== _id)
                }
                options = {change: ["editPortrait", "editOrder"], positions: [position], side: [_side]}
            }
            await requestSettingsUpdate(settings, options)
            // Окно редактирования VN - перемещение (смена) портрета
            // (заметка: из-за того что пустые слоты скрывают img элементы всё немного работает через жопу, потом починю если будет желание, один хуй всё нормально работает)
        } else if (event.target?.classList?.contains("vn-ew-slot") || event.target?.parentElement?.classList?.contains("vn-ew-slot")) {
            settings.activeSpeakers[transferData[1]] = getPortrait(event.target.dataset.id, settings) || null
            settings.activeSpeakers[event.target.dataset.pos] = transferData[0]
            await requestSettingsUpdate(settings, {change: ["editPortrait"], positions: [event.target.dataset.pos, transferData[1]]})
        } else {
            return false
        }
    }
}

Hooks.on("updateSetting", async (setting, value, options, userId) => {
    if (setting.key == `${C.ID}.style`) {
        const changeData = options.change
        const settingData = setting.value
        if (changeData?.includes("choosenSliderSet")) {
            const setData = settingData.sliderSets.find(el => el.id == settingData.choosenSliderSet) || new SlidersSetClass()
            document.getElementById(`vn-up`).querySelector('.vn-header').src = setData.headerImg
            document.getElementById(`vn-left-slide-back`).src = setData.leftSliderBack
            document.getElementById(`vn-left-slide-top`).src = setData.leftSlider
            document.getElementById(`vn-right-slide-back`).src = setData.rightSliderBack
            document.getElementById(`vn-right-slide-top`).src = setData.rightSlider
        }
    } else if (setting.key == `${C.ID}.vnData`) {
        const changeData = options.change
        const settingData = setting.value
        if (!changeData) return

        const permSettings = deepClone(game.settings.get(C.ID, "playersPermissions"))

        const backgroundEl = document.getElementById('vn-background-image')
        const locNameEl = document.querySelector('.vn-current-location-body span');
        const parLocNameEl = document.querySelector('.vn-parent-location-body span');
        const editWindowPortEls = document.querySelectorAll('.vn-ew-slot')

        if (changeData != "showVN" && !settingData.showVN) return

        if (changeData.includes("showVN")) {                    // Переключение режима отображения VN
            // Если скрываем - скрываем для всех и без нюансов
            if (!settingData.showVN || settingData.showForIds?.includes(game.user.id)) {
                VisualNovelDialogues.instance.render(true);
            } else if (!settingData.showForIds) {
                if (!game.user.getFlag(C.ID, "hideVN")) {
                    VisualNovelDialogues.instance.render(true);
                } else {
                    ui.notifications.info(game.i18n.localize(`${C.ID}.settings.youDontSeeVN`));
                }
            }
        }
        if (changeData.includes("changeVisibility")) {
            VisualNovelDialogues.instance.render(true);
        }
        if (changeData.includes("backgroundImage")) {           // Смена изображения - фона
            if (settingData.hideBack || !options.img) return
            backgroundEl.style.backgroundImage = `url(${options.img})`
        }
        if (changeData.includes("editMode")) {                  // Переключение режима редактирования
            if (!allowTo('editWindow', permSettings)) return
            const editModeButtonEl = document.getElementById('vn-editMode-button')
            const pFieldEls = [...document.querySelectorAll('.vn-pField-right'), ...document.querySelectorAll('.vn-pField-left')]
            if (settingData.editMode) {
                editModeButtonEl.classList.add('vn-hlight')
                document.getElementById('vn-edit-window').className = 'vn-shown-fade vn-pointer'
                pFieldEls.forEach(el => el.classList.remove('vn-hidden'))
                document.getElementById('vn-edit-temperature')?.classList?.remove('vn-hidden')
            } else {
                editModeButtonEl.classList.remove('vn-hlight')
                document.getElementById('vn-edit-window').className = 'vn-hidden-fade'
                pFieldEls.forEach(el => el.classList.add('vn-hidden'))
                document.getElementById('vn-edit-temperature')?.classList?.add('vn-hidden')
            }
        }
        if (changeData.includes("linkChanges")) {               // Переключение режима связи изменений
            if (!allowTo('locationChanges', permSettings)) return
            const linkButtonEl = document.getElementById('vn-linkChanges-button').firstElementChild
            if (settingData.linkChanges) {
                linkButtonEl.classList.add('fa-link')
                linkButtonEl.classList.remove('fa-link-slash')
            } else {
                linkButtonEl.classList.add('fa-link-slash')
                linkButtonEl.classList.remove('fa-link')
            }
        }
        if (changeData.includes("changeLocation")) {            // Полная смена локации (фон и header)
            backgroundEl.style.backgroundImage = `url(${settingData.location.backgroundImage})`

            locNameEl.textContent = settingData.location.locationName
            parLocNameEl.textContent = settingData.location.parentLocation
            setFontsSize()

            updateWeater(settingData)
            updateTemperature(settingData)
            updateClock(settingData)
        }
        if (changeData.includes("hideBack")) {                  // Переключение режима невидимости фона
            backgroundEl.classList.toggle('vn-hidden', settingData.hideBack)
            document.getElementById("vn-background-shadow").classList.toggle('vn-hidden', settingData.hideBack)
            document.getElementById("vn-background").style["pointer-events"] = settingData.hideBack ? "none" : null
            document.getElementById("vn-hideBack-button").querySelector('i').style["font-weight"] = settingData.hideBack ? "300" : "800"
        }
        if (changeData.includes("editActiveSpeaker")) {         // Редактирование активного персонажа
            if (!allowTo('editWindow', permSettings) || !settingData.editMode) return
            editWindowPortEls.forEach(m => {
                if (m.dataset.pos == settingData.editActiveSpeaker) {
                    m.classList.add('vn-hlight')
                } else {
                    m.classList.remove('vn-hlight')
                }
            })
            editWindowActorUpdate()
        }
        if (changeData.includes("editPortrait")) {              // Редактирование портрета
            const positions = options.positions.filter(p=>!!p)
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i]
                const portraitData = settingData.activeSpeakers[pos]
                const portraitBodyEl = document.querySelector(`.vn-portrait.${pos}`)
                if (!portraitBodyEl) continue
                portraitBodyEl.classList.remove('vn-anim')
                await new Promise((resolve) => setTimeout(resolve, 50)); // Небольшая задержка чтобы анимация воспроизвелась
                const portraitEl = getActorEl(pos)
                portraitEl.src = portraitData?.img || ""
                portraitEl.parentElement.parentElement.dataset.tooltip = ((portraitData?.name || "") + (portraitData?.title ? `, ${portraitData?.title}` : "")) || ""
                portraitEl.parentElement.parentElement.dataset.id = portraitData?.id || ""
                const isLeft = pos.includes("left")
                if (portraitData?.img) {
                    // Трансформация портрета
                    portraitEl.style.top = `${(portraitData.offsetY || 0) - game.settings.get(C.ID, "worldOffsetY")}px`;
                    portraitEl.style.left = `${portraitData[isLeft ? "offsetXl" : "offsetXr"] || 0}px`;
                    portraitEl.style.transform = `scale(${portraitData.scale || 100}%)`;

                    // Анимация при появлении
                    portraitBodyEl.classList.add('vn-anim')
                    // Отражение по оси X
                    portraitBodyEl.style.transform = `scaleX(${(isLeft !== !!portraitData.mirrorX ? -1 : 1)})`
                    // Размер портрета равен размеру рамки
                    if (portraitData.widthEqualFrame) {
                        portraitBodyEl.style.width = "100%"
                        portraitBodyEl.style.height = "auto"
                    } else {
                        portraitBodyEl.style.removeProperty('width')
                        portraitBodyEl.style.removeProperty('height')
                    }
                }
                if (pos.includes("First") && game.settings.get(C.ID, "sideMainName")) {
                    const textParEl = document.getElementById(`vn-${isLeft ? "left" : "right"}-text`)
                    textParEl.querySelector(`.vn-name`).textContent = portraitData?.name || ""
                    textParEl.querySelector(`.vn-title`).textContent = portraitData?.title || ""
                }
                if (allowTo('editWindow', permSettings)) editWindowActorUpdate(pos)
            }}
        if (changeData.includes("editWindowPortChange")) {      // Изменение портрета в окне редактирования
            if (allowTo('editWindow', permSettings)) editWindowActorUpdate()
        }
        if (changeData.includes("knowTime")) {                  // Переключение режима отображения времени
            const spanEl = document.getElementById("vn-time")?.querySelector("span")
            if (spanEl) spanEl.textContent = settingData.location.knowTime ? `${SimpleCalendar.api.currentDateTimeDisplay().time.replace(/:[^:]*$/, "")}` : "--:--"
        }
        if (changeData.includes("weather")) {                   // Изменение погоды
            updateWeater(settingData)
        }
        if (changeData.includes("clockTime")) {                 // Изменение времени
            updateClock(settingData)
        }
        if (changeData.includes("weatherList")) {               // Обновление списка погоды
            const weatherDropdownEl = document.querySelector('.vn-weather-dropdown.flexcol')
            if (!weatherDropdownEl) return
            weatherDropdownEl.innerHTML = `<div class="vn-weather-option" data-id="new"><i class="fas fa-plus"></i><span>${game.i18n.localize(`${C.ID}.header.newWeather`)}</span></div>`
            for (const w of settingData.weatherList) {
                const wEl = document.createElement('div')
                wEl.className = 'vn-weather-option'
                wEl.dataset.id = w.id
                wEl.dataset.tooltip = w.name
                wEl.innerHTML= `<i class="fas fa-${w.icon}"></i><span>${w.name}</span>`
                addWeatherListener(wEl, weatherDropdownEl);
                weatherDropdownEl.append(wEl)
            }
        }
        if (changeData.includes("temperature")) {               // Изменение температуры
            updateTemperature(settingData)}
        if (changeData.includes("requestAdd")) {
            const oldEl = document.getElementById(`vn-request-body`).querySelector(`[data-id="${options.requestId}"]`)
            if (oldEl) oldEl.remove()
            const containerEl = document.createElement('div')
            containerEl.className = 'vn-request-container vn-request-anim'
            containerEl.dataset.id = options.requestId
            addRequestListener(containerEl, "click")
            addRequestListener(containerEl, "contextmenu")
            const tokenImgEl = document.createElement('img')
            tokenImgEl.src = settingData.effects.requests[options.requestId].img
            const requestImgEl = document.createElement('img')
            const reqLevel = settingData.effects.requests[options.requestId].level
            requestImgEl.src = `modules/${C.ID}/templates/assets/request${reqLevel}.webp`
            requestImgEl.className = `vn-request-img vn-req-level-${reqLevel}`
            containerEl.append(tokenImgEl, requestImgEl)
            document.getElementById('vn-request-body').append(containerEl)
            if (game.settings.get(C.ID, "requestsSound")) {
                AudioHelper.play({
                    src: `modules/${C.ID}/templates/assets/request${reqLevel}.wav`,
                    volume: game.settings.get("core", "globalInterfaceVolume"),
                });
            }
        }
        if (changeData.includes("requestsRemove")) {            // Удаление Заявки
            document.getElementById(`vn-request-body`).querySelector(`[data-id="${options.requestId}"]`).remove()
        }
        if (changeData.includes("editActiveSlots")) {           // Изменение "активных" слотов
            const isActive = (pos) => [...settingData.activeSlots.left, ...settingData.activeSlots.right].includes(pos)
            const numbersArr = (num) => ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"].indexOf(num)+1
            document.querySelectorAll('.vn-portrait').forEach(el => {
                const index = numbersArr(el.parentElement.dataset.pos.split(/(?=[A-Z])/)[1])
                if (isActive(el.parentElement.dataset.pos)) {
                    el.classList.add('vn-main')
                    el.parentElement.style["z-index"] = 89-index
                } else {
                    el.classList.remove('vn-main')
                    el.parentElement.style["z-index"] = 84-index
                }
            })
            if (allowTo('editWindow', permSettings) && settingData.editMode) {
                editWindowPortEls.forEach(el => {
                    if (isActive(el.dataset.pos)) {
                        el.classList.add('vn-active')
                    } else {
                        el.classList.remove('vn-active')
                    }
                })
            }
            if (!game.settings.get(C.ID, "sideMainName")) {
                const leftTextParEl = document.getElementById(`vn-left-text`)
                leftTextParEl.querySelector(`.vn-name`).textContent = settingData.slidersText.left[0] || ""
                leftTextParEl.querySelector(`.vn-title`).textContent = settingData.slidersText.left[1] || ""
                const rightTextParEl = document.getElementById(`vn-right-text`)
                rightTextParEl.querySelector(`.vn-name`).textContent = settingData.slidersText.right[0] || ""
                rightTextParEl.querySelector(`.vn-title`).textContent = settingData.slidersText.right[1] || ""
            }
        }
        if (changeData.includes("hideUI")) {                     // Скрытие UI окна Visual Novel
            document.getElementById('vn-unhideUI-button').style.display = settingData.hideUI ? "grid" : "none"
            const editWindowEl = document.getElementById('vn-edit-window')
            if (editWindowEl) editWindowEl.className = settingData.editMode ? (settingData.showVN && !settingData.hideUI && !game.user.getFlag(C.ID, "hideVN") ? "vn-shown-fade vn-pointer" : "vn-hidden-fade") : "vn-hidden"
            document.querySelector('.vn-buttons-container').style.display = settingData.hideUI ? "none" : "contents"
            const slidersEl = [document.getElementById('vn-up'), document.getElementById('vn-left'), document.getElementById('vn-right')]
            slidersEl.forEach(el => {
                el.className = `${settingData.hideUI ? `vn-hidden` : `vn-shown`}${settingData.showVN ? "-slide" : ""}`
            })
        }
        if (changeData.includes("editOrder")) {                  // Изменение неактивной очереди
            if (!allowTo('miniOrder', permSettings)) return
            const orderBodyEl = options.side == "left" ? document.querySelector('.vn-mo-left') : options.side == "right"? document.querySelector('.vn-mo-right') : null
            if (!orderBodyEl) return
            const orderEls = orderBodyEl.querySelectorAll('.vn-mo-item')
            const orderArr = settingData.order[options.side]
            orderEls.forEach((el, i) => {
                el.style.display = orderArr[i]?.img ? null : "none"
                el.dataset.id = orderArr[i]?.id
                el.dataset.tooltip = orderArr[i]?.name
                el.querySelector('img').src = orderArr[i]?.img || ""
            })
        }
    }
})

function updateClock(settingData) {
    const clockEl = document.getElementById('vn-time')
    if (!clockEl) return
    const time = getTime(true, settingData)
    clockEl.querySelector("span").textContent = time
    const clockNumberEls = document.querySelectorAll('.vn-clock-number')
    clockNumberEls.forEach((el, i) => {
        el.textContent = time[i]
    })
}

function updateWeater(settingData) {
    const weaterContEl = document.getElementById('vn-weather')
    if (!weaterContEl) return
    weaterContEl.dataset.tooltip = settingData.location.weather?.name || "Неизвестная погода"
    weaterContEl.dataset.id = settingData.location.weather?.id || ""
    weaterContEl.querySelector('i').className = `fas vn-chosen-weather ${settingData.location.weather?.icon || "fa-eye-slash"}`
}

function updateTemperature(settingData) {
    const temperatureEl = document.getElementById('vn-temperature')
    if (!temperatureEl) return
    temperatureEl.dataset.tooltip = `${settingData.location.temperature}°C`
    temperatureEl.querySelector('i').style.color = _getTemperatureColor(settingData.location.temperature)
    const temperatureInputEl = temperatureEl.querySelector('input')
    temperatureInputEl.value = settingData.location.temperature
    temperatureInputEl.dataset.tooltip = `${settingData.location.temperature}°C`
}

function addRequestListener(element, action) {
    if (action == "contextmenu") {
        element?.addEventListener('contextmenu', async (event) => {
            await easyDelete(event)
        })
    } else if (action == "click") {
        element?.addEventListener('click', async (event) => {
            if (!game.settings.get(C.ID, "playersPermissions").requests.includes(game.user.role)) {
                easyDelete(event)
                return
            }
            const _id = event.currentTarget.dataset.id
            const settingData = getSettings()
            const portraitData = getPortrait(_id, settingData)
            delete settingData.effects.requests[_id]
            let options = {change: ["requestsRemove"], requestId: _id}
            if (portraitData) {
                const swapPos = Object.keys(settingData.activeSpeakers).find(key => settingData.activeSpeakers[key]?.id === _id);
                if (swapPos == "leftFirst") return
                let position = ["leftFirst"]
                const leftFirstSpeaker = settingData.activeSpeakers["leftFirst"] || null
                if (leftFirstSpeaker) {
                    if (swapPos) {
                        settingData.activeSpeakers[swapPos] = leftFirstSpeaker
                        position.push(swapPos)
                    } else {
                        settingData.order["left"].push({
                            id: leftFirstSpeaker.id,
                            img: leftFirstSpeaker.img,
                            name: `${leftFirstSpeaker.name}${leftFirstSpeaker.title ? `, ${leftFirstSpeaker.title}` : ""}`,
                        })
                        if (settingData.order.length > 6) settingData.order["left"].shift()
                        options = {change: ["requestsRemove", "editOrder"], requestId: _id, side: "left"}
                    }
                }

                if (!settingData.activeSlots["left"].includes("leftFirst")) settingData.activeSlots["left"].push(["leftFirst"])
                settingData.slidersText["left"][0] = portraitData.name
                settingData.slidersText["left"][1] = portraitData.title

                options.change.push("editActiveSlots", "editPortrait")
                options.slotSide = "left"
                options.positions = swapPos ? ["leftFirst", swapPos] : ["leftFirst"]
                settingData.activeSpeakers["leftFirst"] = portraitData
            } else {
                ui.notifications.error(game.i18n.localize(`${C.ID}.errors.noCharacter`))
            }
            await requestSettingsUpdate(settingData, options)
        })
    }
    async function easyDelete(event) {
        const _id = event.currentTarget.dataset.id
        const settingData = getSettings()
        delete settingData.effects.requests[_id]
        const options = {change: ["requestsRemove"], requestId: _id}
        await requestSettingsUpdate(settingData, options)
    }
}

function addWeatherListener(option, dropdown) {
    option?.addEventListener('click', async (event) => {
        if (!allowTo('locationSubChanges')) return
        const settingData = getSettings();
        if (event.currentTarget.getAttribute('data-id') == "new") {
            new Dialog({
                title: 'Create Weather',
                content: `
                <form>
                    <div class="form-group">
                        <label>${game.i18n.localize(`${C.ID}.createWeather.name`)}</label>
                        <input type="text" name="name">
                    </div>
                    <div class="form-group">
                        <label>${game.i18n.localize(`${C.ID}.createWeather.icon`)}</label>
                        <input type="text" name="icon" placeholder="${game.i18n.localize(`${C.ID}.createWeather.iconPlaceholder`)}">
                    </div>
                    <span class="form-group">${game.i18n.localize(`${C.ID}.createWeather.textHelp`)}</span>
                </form>`,
                buttons: {
                    common: { icon: '<i class=""></i>', label: game.i18n.localize(`${C.ID}.createWeather.confirm`), callback: async (html) => {
                            const weather = {
                                name: html.find('input[name="name"]')[0].value || game.i18n.localize(`${C.ID}.createWeather.noName`),
                                icon: "fas fa-" + (html.find('input[name="icon"]')[0].value || "question"),
                                id: randomID()
                            }
                            settingData.weatherList.push(weather)
                            await requestSettingsUpdate(settingData, {change: ["weatherList"]})
                        }}
                },
                default: 'common',
                close: () => {},
            }).render(true);
        } else {
            const location = getLocation(settingData)
            location.forEach(m => {
                m.weather = settingData.weatherList.find(w => w.id == event.currentTarget.getAttribute('data-id')) || null
            })
            await requestSettingsUpdate(settingData, {change: ["weather"], value: event.currentTarget.getAttribute('data-id')})
        }

        dropdown.style.display = 'none';
    });
    option?.addEventListener('contextmenu', async (event) => {
        if (!allowTo('locationSubChanges')) return
        const settingData = getSettings();
        const _weatherName = settingData.weatherList.find(w => w.id == event.currentTarget.getAttribute('data-id'))?.name
        if (!_weatherName || !allowTo('locationSubChanges')) return
        settingData.weatherList = settingData.weatherList.filter(w => w.id != event.currentTarget.getAttribute('data-id'))
        ui.notifications.info(game.i18n.localize(`${C.ID}.header.deleteWeather1`) + _weatherName + game.i18n.localize(`${C.ID}.header.deleteWeather2`));
        await requestSettingsUpdate(settingData, {change: ["weatherList"]})
    })
}

Hooks.on('setup', () => {
    game.socket.on(`module.${C.ID}`, async ({ type, settingData, options }) => {
        if (type === 'renderForAll') {
            VisualNovelDialogues.instance.render(true)
        }
        if (game.user.isGM) {
            switch (type) {
                case 'VNDataSetSettings':
                    await game.settings.set(C.ID, 'vnData', settingData, options);
                    ;
                default:
                    ;
            }
        }
        // Восстановить сохраненные левые слоты
        if (game.user.isGM) {
            const persistentLeft = game.settings.get(C.ID, "persistentLeftSlots") || {};
            settingData.activeSpeakers = { ...settingData.activeSpeakers, ...persistentLeft };
            await game.settings.set(C.ID, "vnData", settingData);
        }
    });
});

// Сохранять левые слоты при обновлении настроек
Hooks.on('updateSetting', async (setting, changes) => {
    if (setting.key === `${C.ID}.vnData` && game.user.isGM) {
        const settingData = getSettings();
        const leftSlots = {};
        ["First", "Second", "Third", "Fourth", "Fifth"].forEach(s => {
            const slot = `left${s}`;
            if (settingData.activeSpeakers[slot]?.id) {
                leftSlots[slot] = settingData.activeSpeakers[slot];
            }
        });
        await game.settings.set(C.ID, "persistentLeftSlots", leftSlots);
    }
});

Hooks.on('renderScene', async () => {
    if (game.user.isGM) {
        const settingData = getSettings();
        if (game.settings.get(C.ID, "autoAssignSlots")) {
            await autoAssignSlots(settingData);
        }
        if (game.settings.get(C.ID, "autoSceneData")) {
            await updateSceneData(settingData);
        }
        VisualNovelDialogues.renderForAll();
    }
});

Hooks.on("renderVisualNovelDialogues", () => {
    setFontsSize()
})

Hooks.on(`simple-calendar-date-time-change`, (calendarData) => {
    const settings = getSettings()
    if (!settings.showVN || !settings.location?.knowTime) return
    const spanEl = document.getElementById("vn-time")?.querySelector("span")
    if (spanEl) spanEl.textContent = `${calendarData.date.display.time.replace(/:[^:]*$/, "")}`
})

// Изменяем цвета в списке игроко в углу окна VN когда кто-то скрывает/раскрывает окно VN для себя
Hooks.on("updateUser", (user, changes) => {
    const hideVNFlag = changes?.flags?.[C.ID]?.hideVN
    if (typeof hideVNFlag === "boolean") {
        if (game.user.id == user.id) {
            // Это нужно чтобы при мануальном изменении флага у другого игрока у него ре-ренедрилось окно визуалки
            VisualNovelDialogues.instance?.render(true)
        }
        const playerListBodyEl = document.getElementById("vn-player-list-body")
        const playerEl = playerListBodyEl.querySelector(`[data-user-id="${user.id}"]`)
        const spanEl = playerEl.querySelector(".player-active")
        spanEl.classList.toggle("inactive", hideVNFlag)
        spanEl.classList.toggle("active", !hideVNFlag)
        spanEl.style.backgroundColor = hideVNFlag ? "#333333" : user.color
        playerEl.querySelector(".player-active").dataset.tooltip = `${user.name}${hideVNFlag ? game.i18n.localize(`${C.ID}.placeholders.hide`) : ""}`
    }
})

// Изменяем список игроков в углу окна VN когда кто-то входит/выходит
Hooks.on("userConnected", (user, joined) => {
    const playerListBodyEl = document.getElementById("vn-player-list-body")
    if (joined) {
        const settings = getSettings()
        const hideVN = game.user.getFlag(C.ID, "hideVN") || false
        const active = !settings.showForIds || settings.showForIds?.includes(user.id)

        const liEl = document.createElement("li")
        liEl.className = "player flexrow"
        liEl.setAttribute("data-user-id", user.id)
        liEl.innerHTML = `
            <span class="player-active ${hideVN ? `inactive" style="background: #333333` : `active" style="background: ${user.color}`}; border: 1px solid"></span>
            <span class="player-name" data-tooltip="${user.name}${(hideVN || !active) ? game.i18n.localize(`${C.ID}.placeholders.hide`) : ""}" style="color: ${active ? "56d905" : "fd6d07"};">${user.name}</span>
        `
        liEl.addEventListener('contextmenu', async (event) => {
            if (!allowTo('displayControl')) return
            contextMenuListener(event.currentTarget)
        })

        const playersArrayIds = game.users.filter(u => u.active).map(u => u.id)
        const prevUserId = playersArrayIds[playersArrayIds.indexOf(user.id) - 1]
        if (prevUserId) {
            const prevEl = playerListBodyEl.querySelector(`[data-user-id="${prevUserId}"]`)
            prevEl.insertAdjacentElement('afterend', liEl)
        } else {
            playerListBodyEl.prepend(liEl)
        }

    } else {
        const userId = user.id
        const elToDelete = playerListBodyEl.querySelector(`[data-user-id="${userId}"]`)
        playerListBodyEl.removeChild(elToDelete)
    }
})

// А это надо чтобы "Предпросмотр" сетов слайдеров откатить когда окно закрывают :з
Hooks.on("closeCustomSlidersSet", () => {
    VisualNovelDialogues.instance.render(true)
    const setData = SlidersSetClass.getActiveSet()
    document.getElementById(`vn-up`).querySelector('.vn-header').src = setData.headerImg
    document.getElementById(`vn-left-slide-back`).src = setData.leftSliderBack
    document.getElementById(`vn-left-slide-top`).src = setData.leftSlider
    document.getElementById(`vn-right-slide-back`).src = setData.rightSliderBack
    document.getElementById(`vn-right-slide-top`).src = setData.rightSlider
})

// ПКМ на пользователя в списке игроков в правом верхнем углу окна Visual Novel
function contextMenuListener(element) {
    function closeDropdownOnClickOutside(event) {
        const dropdown = document.querySelector('.vn-players-list-dropdown');
        if (!dropdown?.contains(event.target)) {
            dropdown?.remove();
            document.removeEventListener('click', closeDropdownOnClickOutside);
        }
    }
    // Закрываем все старые окошки
    const existingEls = document.querySelectorAll('.vn-players-list-dropdown')
    existingEls.forEach(el => el.remove())
    // Создаём новое окошко
    const _id = element.dataset.userId
    const dropdownListEl = document.createElement('nav')
    const olEl = document.createElement('ol')
    olEl.className = 'vn-context-items'

    const user = game.users.get(_id)
    const settings = getSettings()
    const showForIds = settings.showForIds && settings.showForIds?.length > 0 ? settings.showForIds : game.users.map(u => u.id)
    const isActive = showForIds.includes(_id)

    function createButton(key, icon, onClick) {
        const button = document.createElement('li')
        button.className = 'vn-context-item'
        button.innerHTML = `<i class="fas fa-${icon} fa-fw"></i><span>${game.i18n.localize(`${C.ID}.contextmenu.${key}`)}</span>`
        button.addEventListener('click', onClick)
        olEl.append(button)
    }

    if (user?.isGM) {
        // Выключаем VN для всех кроме себя
        createButton('onlyYou', 'street-view', async () => {
            const settings = getSettings()
            settings.showForIds = [game.user.id]
            await requestSettingsUpdate(settings, {change: ['changeVisibility']})
        })
    } else {
        // Выключаем VN для всех кроме себя и выбранного
        createButton('dialogue', 'people-arrows', async () => {
            const settings = getSettings()
            settings.showForIds = [game.user.id, _id]
            await requestSettingsUpdate(settings, {change: ['changeVisibility']})
        })
        // Переключаем отображение для выбранного
        createButton(`switch${isActive ? "Hide" : "Show"}`, `eye${isActive ? "-slash" : ""}`, async () => {
            const settings = getSettings()
            if (settings.showForIds && settings.showForIds?.length > 0) {
                settings.showForIds = settings.showForIds.includes(_id) ? settings.showForIds.filter(id => id !== _id) : [...settings.showForIds, _id]
            } else {
                settings.showForIds = game.users.map(u => u.id).filter(id => id !== _id)
            }
            await requestSettingsUpdate(settings, {change: ['changeVisibility']})
        })
        // Если чувак скрывает сам - дать пизды флагу
        if (user?.getFlag(C.ID, "hideVN")) {
            createButton('turnOffHide', 'people-pulling', async () => {
                await user.setFlag(C.ID, "hideVN", false)
            })
        }
    }

    dropdownListEl.className = 'vn-players-list-dropdown'
    dropdownListEl.append(olEl)
    element.appendChild(dropdownListEl)
    document.addEventListener('click', closeDropdownOnClickOutside);
}
