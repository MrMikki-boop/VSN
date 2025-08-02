export const Constants = {
    ID: "visual-novel-dialogues",
    backgroundPlaceholder: () => game.settings.get(Constants.ID, "backgroundPlaceholder"),
    portraitFoldersPath: () => game.settings.get(Constants.ID, "portraitFoldersPath"),
    backgoundFoldersPath: () => game.settings.get(Constants.ID, "backgoundFoldersPath"),
    headerImg: "modules/visual-novel-dialogues/templates/assets/header-body.webp",
    leftSlider: "modules/visual-novel-dialogues/templates/assets/left-slide-top.webp",
    rightSlider: "modules/visual-novel-dialogues/templates/assets/right-slide-top.webp",
    leftSliderBack: "modules/visual-novel-dialogues/templates/assets/left-slide-back.webp",
    rightSliderBack: "modules/visual-novel-dialogues/templates/assets/right-slide-back.webp",
}

export const getSettings = () => foundry.utils.deepClone(game.settings.get(Constants.ID, "vnData"));

export const getLocation = (settingData) => {
    return settingData.linkChanges
        ? [settingData.location, settingData.locationList.find(m => m.id == settingData.location.id)]
        : [settingData.location]
}

export const getTags = (source, arr = [game.i18n.localize(`${Constants.ID}.placeholders.defaultMainFolderName`), game.i18n.localize(`${Constants.ID}.placeholders.noFolder`)]) => {
    if (source?.folder) {
        arr[1] = source?.name
        return getTags(source?.folder, arr)
    } else {
        arr[0] = source?.name || arr[0]
        return arr
    }
}

export const getPortrait = (id, settings = getSettings()) => settings.portraits.find(m => m.id == id)

export const updatePortrait = async (id, newData, settings = getSettings(), _return = false) => {
    if (getPortrait(id, settings)) {
        settings.portraits = settings.portraits.map(m => m.id == id ? newData : m)
    } else {
        settings.portraits.push(newData)
    }
    if (_return) return settings
    else await requestSettingsUpdate(settings)
}

export const selectorArray = () => {
    return {
        'ChatMessages': "comments",
        'Combats': "sword",
        "Scenes": "map",
        'Actors': "user",
        'Items': "suitcase",
        'JournalEntries': "book-open",
        'RollTables': "th-list",
        'CardsPlural': "cards",
        'Playlists': "music",
        'TabCompendium': "atlas",
        'Settings': "cogs"
    }
}

export const getEmptyActiveSpeakers = (sides = ["left", "right", "center"], numbers = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"]) => {
    let _obj = {};
    sides.forEach(side => {
        numbers.forEach(num => {
            _obj[`${side}${num}`] = null;
        });
    });
    return _obj;
}

export async function createBackup() {
    let count;
    const backupPath = `${game.data.dataDir}/visual-novel-backups`;
    try {
        count = await foundry.applications.apps.FilePicker.implementation.browse("data", backupPath);
    } catch (error) {
        console.log(`%c${game.i18n.localize(`${Constants.ID}.errors.createBackup`)}:`, "color:red");
        await foundry.applications.apps.FilePicker.implementation.createDirectory("data", backupPath);
    }
    const newFile = new File([JSON.stringify(game.settings.get(Constants.ID, 'vnData'))], `settingDataBackup-${count?.files?.length || 0}.json`, { type: "application/json" });
    await foundry.applications.apps.FilePicker.implementation.upload("data", backupPath, newFile, {}, { notify: false });
}

export const getTextureSize = async (imgPath) => {
    const textureData = await loadTexture(imgPath)
    return {x: textureData.width, y: textureData.height}
}

export const defaultPermissions = {
    editWindow: [3, 4],
    portraitInteraction: [1, 2, 3, 4],
    requests: [1, 2, 3, 4],
    miniOrder: [3, 4],
    locationSubChanges: [2, 3, 4],
    locationChanges: [3, 4],
    displayControl: [3, 4]
}

export async function requestSettingsUpdate(settingData, options) {
    if (game.user.isGM) {
        await game.settings.set(Constants.ID, 'vnData', settingData, options);
    } else {
        game.socket.emit(`module.${Constants.ID}`, {
            type: 'VNDataSetSettings',
            settingData: settingData,
            options: options
        });
    }
}

export const allowTo = (key, permSettings = foundry.utils.deepClone(game.settings.get(Constants.ID, "playersPermissions"))) => permSettings[key].includes(game.user.role)

export function setFontsSize(UIsize = [0.33, 0.85, 0.7]) {
    const locNameEl = document.getElementById("vn-current-location-body")?.querySelector("span")
    const parLocNameEl = document.getElementById("vn-parent-location-body")?.querySelector("span")
    const spanWidth = window.innerWidth * UIsize[0] * UIsize[1] * UIsize[2] * 0.95
    if (locNameEl) {
        locNameEl.style.fontSize = `1vw`
        const locWidth = locNameEl.offsetWidth;
        locNameEl.style.fontSize = `${Math.min((spanWidth / locWidth).toFixed(2), 2.9)}vw`
    }
    if (parLocNameEl) {
        parLocNameEl.style.fontSize = `1vw`
        const parLocWidth = parLocNameEl.offsetWidth
        parLocNameEl.style.fontSize = `${Math.min((spanWidth / parLocWidth).toFixed(2), 2.6)}vw`
    }
}

export const useSimpleCalendar = () => game.modules.get("foundryvtt-simple-calendar")?.active && game.settings.get(Constants.ID, "useSimpleCalendar") && foundry.utils.isNewerVersion(game.modules.get("foundryvtt-simple-calendar")?.version, "2.1.58")

export const getTime = (knowTime = true, settings = getSettings()) => {
    if (knowTime) {
        const time = useSimpleCalendar() ? SimpleCalendar.api.currentDateTimeDisplay().time.replace(/:[^:]*$/, "") : (settings.clockTime || "12:30")
        return time
    } else {
        return "--:--"
    }
}

export const uiButtonsIcons = {
    hideVN: "fas fa-eye-slash",
    openActor: "fas fa-user",
    hideUI: "fas fa-tv",
    hideBack: "fas fa-image",
    selector: "fas fa-caret-right",
    playerList: "fas fa-caret-right",
    requestFirst: "far fa-hand",
    requestSecond: "fas fa-hand",
    requestThird: "fas fa-hand-sparkles"
}