import { Constants as C, getPortrait, getSettings, getTags, updatePortrait } from '../scripts/const.js';
import { ActorPicker } from './actorPicker.js';

export class ActorPickerSub extends FormApplication {
    constructor(portraitId = "") {
        super();
        this.portraitId = portraitId;
    }
    
    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            classes: ['ap-sub-body'],
            width: 540,
            height: 450,
            resizable: false,
            id: "ActorPickerSub",
            template: `modules/${C.ID}/templates/actorPickerSub.hbs`,
            title: `Actor-picker Settings`,
            userId: game.userId,
            closeOnSubmit: true,
            submitOnChange: false
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    getData(options) {
        const portFlags = getPortrait(this.portraitId) || {name: game.actors.get(this.portraitId)?.prototypeToken?.name};
        return { portFlags: portFlags };
    }

    activateListeners(html) {
        super.activateListeners(html);
        const _id = this.portraitId || randomID()
        html.find('.aps-submit-button').on('click', async (event) => {
            const newImg = html[0].querySelector('.aps-choose-img').value
            const _imgIsFine = await srcExists(newImg || "")
            if (!_imgIsFine) {
                ui.notifications.error(game.i18n.localize(`${C.ID}.actorPickerSub.nonExistImg`))
                return
            } else {
                const actor = game.actors.get(_id)
                const flag = getPortrait(_id) || {
                    img: newImg,
                    name: html[0].querySelector('.aps-text-input.aps-name').value,
                    title: html[0].querySelector('.aps-text-input.aps-title').value,
                    tag: actor ? getTags(actor.folder) : [game.i18n.localize(`${C.ID}.placeholders.defaultMainFolderName`), game.i18n.localize(`${C.ID}.placeholders.noFolder`)],
                    id: actor?.id || _id,
                    scale: 100,
                    offsetXl: 0,
                    offsetXr: 0,
                    offsetY: 0,
                    hasActor: !!actor
                }
                const imgElValue = html[0].querySelector('.aps-choose-img')?.value
                const nameElValue = html[0].querySelector('.aps-text-input.aps-name')?.value
                const titleElValue = html[0].querySelector('.aps-text-input.aps-title')?.value
                if (imgElValue !== flag.img) flag.img = imgElValue
                if (nameElValue) flag.name = nameElValue
                if (titleElValue) flag.title = titleElValue
                if (!flag.name) {
                    ui.notifications.error(game.i18n.localize(`${C.ID}.actorPickerSub.noName`))
                    return
                }
                if (!foundry.utils.objectsEqual(flag, getPortrait(_id) || {})) {
                    if (game.user.isGM || actor?.ownership?.[game.user.id] >= 3) {
                        await updatePortrait(_id, flag)
                        ActorPicker.refresh()
                    } else {
                        ui.notifications.error(game.i18n.localize(`${C.ID}.actorPickerSub.noPermission`))
                        return
                    }
                }
                this.close();
            }
        });
        html.find('.aps-delete-button').on('click', async (event) => {
            const settings = getSettings()
            settings.portraits = settings.portraits.filter(m => m.id != _id)
            await game.settings.set(C.ID, "vnData", settings)
            this.close();
        })
        html.find('.aps-file-picker').on('click', async (event) => {
            const fp = new FilePicker({classes: ["filepicker"], current: C.portraitFoldersPath(), type: "imagevideo", displayMode: "thumbs", callback: async (image) => {
                if (image) {
                    const input = html[0].querySelector('.aps-choose-img')
                    input.value = decodeURI(image).replace(`%2C`, `,`)
                };
            }}).render();
        })
    }

    async _updateObject(event, formData) {
    }
}