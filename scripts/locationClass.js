import { Constants as C, requestSettingsUpdate } from "./const.js";

export class VNLocation {
    constructor(data) {
        this.id = randomID()
        this._sourceData = data

        this.locationName = data.locationName
        this.parentLocation = data.parentLocation || "???"
        this.backgroundImage = data.backgroundImage || C.backgroundPlaceholder()
        this.weather = data.weather || null
        this.temperature = data.temperature || 20
        this.knowTime = data.knowTime || true
        this.locationTags = data.locationTags || []
        this.presets = data.presets || []
        this.scale = data.scale || 100
        this.offsetX = data.offsetX || 0
        this.offsetY = data.offsetY || 0
    }

    static async delete(id) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'))
        settings.locationList = settings.locationList.filter(m => m.id != id)
        await requestSettingsUpdate(settings)
    }

    static async updateFilterList(id, filterArray) {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'))
        const location = [settings.locationList.find(m => m.id == id)]
        if (settings.location.id == id) {
            location.push(settings.location)
        }
        location.forEach(m => m.locationTags = filterArray)
        await requestSettingsUpdate(settings)
    }

    static getActive() {
        const settings = foundry.utils.deepClone(game.settings.get(C.ID, 'vnData'))
        return settings.locationList.find(m => m.id == settings.location.id)
    }
}