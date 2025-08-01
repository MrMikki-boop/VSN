import { Constants as C, createBackup, defaultPermissions, getSettings, selectorArray } from './const.js';
import { VisualNovelDialogues } from './main.js';
import { SlidersSetClass } from './slidersSetClass.js';

let settingCategories = {};
export function addMenuSetting(key, category) {
    setProperty(settingCategories, key.split(' ').join('-'), category);
}
export class vndSelectorMenu extends FormApplication {
    constructor() {
        super();
        this.category = "selectorMenu";
    }
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            'classes': ['form'],
            'popOut': true,
            'template': `modules/${C.ID}/templates/config.html`,
            'id': `${C.ID}-settings`,
            'title': 'Selector Menu Settings',
            'width': 'auto',
            'height': 'auto',
            'closeOnSubmit': true
        });
    }
    getData() {
        let generatedOptions = [];
        const _selectorArray = selectorArray();
	    for (let setting of game.settings.settings.values()) {
            if (setting.namespace != C.ID) continue;
            let key = setting.key.split(' ').join('-');
            if (settingCategories[key] != this.category) continue;
            const s = foundry.utils.deepClone(setting);
            s.icon = _selectorArray[s.name.replace(/.*\./, "")];
            s.name = game.i18n.localize(s.name);
            s.id = `${s.key}`;
            s.value = game.settings.get(s.namespace, s.key);
            s.type = setting.type instanceof Function ? setting.type.name : 'String';
            s.isCheckbox = setting.type === Boolean;
            s.isSelect = s.choices !== undefined;
            s.isRange = (setting.type === Number) && s.range;
            s.isNumber = setting.type === Number;
            s.filePickerType = s.filePicker === true ? 'any' : s.filePicker;
            s.isButton = setting.type instanceof Object && setting.type.name != 'String';
            s.label = ""
            generatedOptions.push(s);
	    }
        return {'settings': generatedOptions.sort(function (a, b) {
            let nameA = a.name.toUpperCase();
            let nameB = b.name.toUpperCase();
            if (nameA > nameB) {
                return 1;
            } else if (nameA < nameB) {
                return -1;
            } else {
                return 0;
            }
        })};
    }
    activateListeners(html) {
        super.activateListeners(html);
    }
    async _updateObject(event, formData) {
        for (let [key, value] of Object.entries(formData)) {
            if (game.settings.get(C.ID, key) === value) continue;
            await game.settings.set(C.ID, key, value);
            VisualNovelDialogues.instance.render(true);
        }
    }
}

export class RestoreFromBackup extends FormApplication {
    constructor() {
        super();
    }
    
    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['vn-restore-fb'],
            width: 540,
            height: "auto",
            resizable: false,
            id: `${randomID()}`,
            template: `modules/${C.ID}/templates/restoreFromBackup.hbs`,
            title: `RestoreFromBackup`,
            userId: game.userId,
            closeOnSubmit: true,
            submitOnChange: false
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    getData(options) {
        return {};
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.rfb-file-picker').on('click', async (event) => {
            const fp = new FilePicker({classes: ["filepicker"], current: `modules/${C.ID}/settingsBackups`, type: "file", displayMode: "list", callback: async (file) => {
                if (file) {
                    const input = html[0].querySelector('.rfb-choose-file')
                    input.value = decodeURI(file).replace(`%2C`, `,`)
                };
            }}).render();
        })
        html.find(`.rfb-submit-button`).on('click', async (event) => {
            const file = html[0].querySelector('.rfb-choose-file').value
            if (!file) {
                ui.notifications.error(game.i18n.localize(`${C.ID}.restoreFromBackup.noFile`))
                return
            }
            if (html[0].querySelector('.rfb-create-backup')?.checked) {
                await createBackup()
            }
            const backup = await foundry.utils.fetchJsonWithTimeout(file)
            await game.settings.set(C.ID, 'vnData', backup)
            ui.notifications.info(game.i18n.localize(`${C.ID}.restoreFromBackup.success`) + ` ${file} ✔`)
        })
    }

    async _updateObject(event, formData) {
    }
}


export class CreateBackup extends FormApplication {
    constructor() {
        super();
    }
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = '';
        options.id = 'vn-create-backup';
        options.template = `modules/${C.ID}/templates/createBackup.html`;
        options.closeOnSubmit = true;
        options.popOut = true;
        options.width = 1;
        options.height = 1;
        return options;
    }
    static async createBackup(app) {
        await createBackup();
        ui.notifications.info(game.i18n.localize(`${C.ID}.settings.backupCreated`));
        app.close({ force: true });
    }
}
Hooks.on("renderCreateBackup", CreateBackup.createBackup);

export class CustomSlidersSet extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = 'Custom Slider Sets';
        options.classes = ['csm-settings'];
        options.id = 'vn-custom-sliders';
        options.template = `modules/${C.ID}/templates/customSlidersSet.hbs`;
        options.closeOnSubmit = false;
        options.popOut = true;
        options.width = 500;
        return options;
    }

    getData(options) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'style'))
        const defaultSet = new SlidersSetClass()
        defaultSet.id = ""
        const sliderSets = [defaultSet, ...settings.sliderSets]

        return {groups: sliderSets};
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Выбор сета как активного
        html.find('.csn-images').on('click', async (event) => {
            const setId = event.currentTarget.parentElement.dataset.id
            const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'style'))
            settings.choosenSliderSet = setId
            await game.settings.set(C.ID, 'style', settings, {change: ['choosenSliderSet']})
        })
        // Предпросмотр сета
        html.find('.csm-preview').on('click', async (event) => {
            const settings = getSettings()
            if (settings.showVN) {
                VisualNovelDialogues.instance.render(true)
            } else {
                VisualNovelDialogues.turnVN(true)
            }
            const setId = event.currentTarget.parentElement.parentElement.dataset.id
            const styleSettings = foundry.utils.deepClone(game.settings.get(C.ID, 'style'))
            const setData = styleSettings.sliderSets.find(el => el.id == setId)
            if (!setData) return
            await new Promise((resolve) => setTimeout(resolve, 50)); // Небольшая задержка чтобы круто было блять крч чё доебался???
            document.getElementById(`vn-up`).querySelector('.vn-header').src = setData.headerImg
            document.getElementById(`vn-left-slide-back`).src = setData.leftSliderBack
            document.getElementById(`vn-left-slide-top`).src = setData.leftSlider
            document.getElementById(`vn-right-slide-back`).src = setData.rightSliderBack
            document.getElementById(`vn-right-slide-top`).src = setData.rightSlider
        })
        // Изменение настроек сета
        html.find('.csm-edit').on('click', async (event) => {
            const setId = event.currentTarget.parentElement.parentElement.dataset.id
            if (!setId) return
            const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'style'))
            const sliderData = settings.sliderSets.find(s => s.id == setId)
            let content = `<form>`
            if (!sliderData) {
                ui.notifications.error(game.i18n.localize(`${C.ID}.errors.sliderSetNotFound`))
                return
            }
            [`headerImg`, `leftSlider`, `rightSlider`, `leftSliderBack`, `rightSliderBack`].forEach(key => {
                content += `<div class="css-path-field form-group">
                    <img src="${sliderData[key]}" name="${key}" style="width: 100%;"/>
                    <div class="form-fields">
                        <button type="button" class="aps-file-picker" data-key="${key}" style="order: 99;" title="${game.i18n.localize(`${C.ID}.actorPickerSub.selectImg`)}">
                            <i class="fas fa-file-import fa-fw"></i>
                        </button>
                        <input class="image aps-choose-img" name="${key}" type="text" placeholder="path/image.png" value="${sliderData[key]}">
                    </div>
                </div>`
            })
            content+=`</form>`
            new Dialog({
                title: 'Custom sliders set Settings',
                content: content,
                buttons: {
                    common: { icon: '<i class="fas fa-check"></i>', label: game.i18n.localize(`${C.ID}.customSliders.confirm`), callback: async (html) => {
                        const updates = {
                            headerImg: html[0].querySelector(`input[name="headerImg"]`).value,
                            leftSlider: html[0].querySelector(`input[name="leftSlider"]`).value,
                            rightSlider: html[0].querySelector(`input[name="rightSlider"]`).value,
                            leftSliderBack: html[0].querySelector(`input[name="leftSliderBack"]`).value,
                            rightSliderBack: html[0].querySelector(`input[name="rightSliderBack"]`).value
                        }
                        await SlidersSetClass.updateSet(setId, updates)
                        this.rerender()
                    }}
                },
                default: 'common',
                render: (html) => { 
                    html.find('.aps-file-picker').on('click', async (event) => {
                        const fp = new FilePicker({classes: ["filepicker"], type: "image", displayMode: "thumbs", callback: async (image) => {
                            if (image) {
                                const input = html[0].querySelector(`.css-path-field input[name="${event.currentTarget.dataset.key}"]`)
                                input.value = image
                                const imgEl = html[0].querySelector(`.css-path-field img[name="${event.currentTarget.dataset.key}"]`)
                                imgEl.src = image
                            };
                        }}).render();
                    })
                },
            }).render(true);
        })
        // Добавление нового сета
        html.find('.csm-addButton').on('click', async () => {
            const settings = deepClone(game.settings.get(C.ID, 'style'))
            settings.sliderSets.push(new SlidersSetClass())
            await game.settings.set(C.ID, 'style', settings)
            this.rerender()
        })
        // Удаление сета
        html.find('.csm-delete-button').on('click', async (event) => {
            const settings = deepClone(game.settings.get(C.ID, 'style'))
            settings.sliderSets = settings.sliderSets.filter(s => s.id != event.currentTarget.dataset.id)
            await game.settings.set(C.ID, 'style', settings)
            this.rerender()
        })
    }

    async _updateObject(event, formData) {
    }

    rerender() {
        this.render(true)
    }
}

export class PlayersPermissions extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = 'Players Permissions';
        options.classes = ['vn-players-permissions'];
        options.id = 'vn-players-permissions';
        options.template = `modules/${C.ID}/templates/playersPermissions.hbs`;
        options.closeOnSubmit = true;
        options.popOut = true;
        options.width = 660;
        return options;
    }

    getData(options) {
        const permTransform = (arr) => [0,0,0,0].reduce((acc, el, i) => {
            acc[i] = {index: i+1, select: arr.includes(i+1)}
            return acc
        }, [])
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'playersPermissions'))
        const permissions = Object.keys(settings).reduce((acc, el) => {
            acc.push({name: el, perms: permTransform(settings[el])})
            return acc
        }, [])
        return { permissions: permissions };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Сохранение настроек
        html.find('.pps-submit-button').on('click', async (event) => {
            const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'playersPermissions'))
            const fieldEls = html[0].querySelectorAll('.permission.form-group')
            fieldEls.forEach(el => {
                const name = el.dataset.name
                const permEls = el.querySelectorAll('input')
                settings[name] = Array.from(permEls).reduce((acc, el) => {
                    if (el.checked) {
                        acc.push(parseInt(el.dataset.index))
                    }
                    return acc
                }, [])
            })
            await game.settings.set(C.ID, 'playersPermissions', settings)
        })
        // Сброс настроек
        html.find('.pps-reset-button').on('click', async (event) => {
            const defaultSettings = defaultPermissions
            await game.settings.set(C.ID, 'playersPermissions', defaultSettings)
            ui.notifications.info(game.i18n.localize(`${C.ID}.settings.playersPermissionsReset`))
        })
    }

    async _updateObject(event, formData) {
    }

    rerender() {
        this.render(true)
    }
}

export class AssetPacksSelectMenu extends FormApplication {
    constructor(showLocations = true, showPortraits = true) {
        super();
        this.category = "assetPacksSelectMenu";
        this.showLocations = showLocations;
        this.showPortraits = showPortraits;
    }
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            'classes': ['form'],
            'popOut': true,
            'template': `modules/${C.ID}/templates/assetPacksSelectMenu.hbs`,
            'id': `${C.ID}-asset-packs-select-menu`,
            'title': 'Asset packs select menu',
            'width': 'auto',
            'height': 'auto',
            'closeOnSubmit': true
        });
    }

    getData() {
        let packs = deepClone(game.settings.get(C.ID, 'assetPacks'))
        packs.portraitPacks.forEach((pack) => { pack.count = pack.ids.length })
        packs.locationPacks.forEach((pack) => { pack.count = pack.ids.length })
        return { ...packs, showLocations: this.showLocations, showPortraits: this.showPortraits };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.apsm-submit-button').on('click', async () => {
            const settings = deepClone(game.settings.get(C.ID, 'assetPacks'))
            if (this.showLocations) {
                const checkedPortraitInputs = html[0].querySelectorAll('.apsm-input.aspm-locInput input:checked')
                const activeIds = Array.from(checkedPortraitInputs).map(el => el.dataset.id)
                settings.portraitPacks.forEach((pack) => { pack.active = activeIds.includes(pack.id) })
            }
            if (this.showPortraits) {
                const checkedPortraitInputs = html[0].querySelectorAll('.apsm-input.aspm-portraitInput input:checked')
                const activeIds = Array.from(checkedPortraitInputs).map(el => el.dataset.id)
                settings.portraitPacks.forEach((pack) => { pack.active = activeIds.includes(pack.id) })
            }
            await game.settings.set(C.ID, 'assetPacks', settings)
        })
    }

    async _updateObject(event, formData) {
    }
}