import { Constants as C } from "./const.js";

export class PresetUIClass {
    constructor(data = {}) {
        this.id = foundry.utils.randomID()
        this.name = data.name || game.i18n.localize(`${C.ID}.visualSettingsMenu.newPreset`)
        this.hotkey = null
        this._sourceData = data

        this.activeElements = {
            headerSlider: true,
            leftSlider: true,
            rightSlider: true,
            locName: true,
            parLocName: true,
            clock: true,
            weather: true,
            temperature: true,
            leftNameBox: true,
            leftName: true,
            leftTitle: true,
            rightNameBox: true,
            rightName: true,
            rightTitle: true,
            hideVN: true,
            openActor: true,
            hideUI: true,
            hideBack: true,
            selector: true,
            playerList: true,
            requestFirst: true,
            requestThird: true
        }
        this.offset = {
            headerSliderX: 0,
            headerSliderY: 0,
            leftSliderX: 0,
            leftSliderY: 62,
            rightSliderX: 0,
            rightSliderY: 62
        }
        this.scale = {
            headerSlider: 100,
            leftSlider: 100,
            rightSlider: 100
        }
        this.mainSlot = {
            left: "first",
            right: "first"
        }
        this.slotCount = {
            left: null,
            right: null
        }
    }

    static async addPreset(data = {}) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        const presetData = new PresetUIClass(data)
        settings.presets.push(presetData)
        await game.settings.set(C.ID, 'presetsUI', settings)
        return presetData.id
    }

    static async deletePreset(id) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        settings.presets = settings.presets.filter(s => s.id != id)
        await game.settings.set(C.ID, 'presetsUI', settings)
    }

    static async setPreset(id) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        settings.choosenPreset = id
        await game.settings.set(C.ID, 'presetsUI', settings)
    }

    static async setDefault() {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        settings.choosenPreset = ""
        await game.settings.set(C.ID, 'presetsUI', settings)
    }

    static getActivePreset() {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        let preset = settings.choosenPreset ? settings.presets.find(s => s.id == settings.choosenPreset) : null
        if (!preset) preset = new PresetUIClass()
        return preset
    }

    static getPreset(id) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        let preset = settings.presets.find(s => s.id == id)
        if (!preset) preset = new PresetUIClass()
        return preset
    }

    static async updatePreset(id, dataObject) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'presetsUI'))
        let preset = settings.presets.find(s => s.id == id)
        if (!preset) {
            ui.notifications.error(game.i18n.localize(`${C.ID}.errors.presetNotFound`))
            return
        }
        preset = foundry.utils.mergeObject(preset, dataObject, {insertKeys: false});
        await game.settings.set(C.ID, 'presetsUI', settings)
    }
}