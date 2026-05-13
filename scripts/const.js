export const Constants = {
    ID: "visual-novel-dialogues",
    defaultBackupFolder: "visual-novel-backups",
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

export function normalizePortraitName(name = "") {
    return String(name || "").split(/\s+\/\s+/)[0].trim();
}

export function isDefaultImage(src) {
    return !src || src.includes("icons/svg/mystery-man");
}

export function getActorPortraitImage(actor, {preferToken = game.settings.get(Constants.ID, "useTokenForPortraits"), fallbackUser = null} = {}) {
    const tokenImg = actor?.prototypeToken?.texture?.src;
    const actorImg = actor?.img;
    const userImg = fallbackUser?.avatar;
    const candidates = preferToken ? [tokenImg, actorImg, userImg] : [actorImg, tokenImg, userImg];
    return candidates.find(src => !isDefaultImage(src)) || "";
}

export function getActorPortraitData(actor, {existing = {}, img = null, fallbackUser = null} = {}) {
    const name = existing.name || actor?.prototypeToken?.name || actor?.name || fallbackUser?.name || "";
    return {
        img: img ?? existing.img ?? getActorPortraitImage(actor, {fallbackUser}),
        name: normalizePortraitName(name),
        title: existing.title || "",
        tag: existing.tag || getTags(actor?.folder),
        id: actor?.id || fallbackUser?.id,
        scale: existing.scale ?? 100,
        offsetXl: existing.offsetXl ?? 0,
        offsetXr: existing.offsetXr ?? 0,
        offsetY: existing.offsetY ?? 0,
        mirrorX: existing.mirrorX ?? false,
        widthEqualFrame: existing.widthEqualFrame ?? game.settings.get(Constants.ID, "worldWidthEqualFrame"),
        hasActor: !!actor
    };
}

export const updatePortrait = async (id, newData, settings = getSettings(), _return = false) => {
    if (newData?.name) newData.name = normalizePortraitName(newData.name);
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

export function getBackupFolder() {
    const settingKey = `${Constants.ID}.backupFolder`;
    if (game.settings.settings.has(settingKey)) {
        return game.settings.get(Constants.ID, "backupFolder") || Constants.defaultBackupFolder;
    }
    return Constants.defaultBackupFolder;
}

async function ensureDataDirectory(folderPath) {
    const normalized = folderPath.replace(/^\/+|\/+$/g, "");
    if (!normalized) return "";

    let current = "";
    for (const segment of normalized.split("/").filter(Boolean)) {
        current = current ? `${current}/${segment}` : segment;
        try {
            await FilePicker.browse("data", current);
        } catch (error) {
            await FilePicker.createDirectory("data", current, { bucket: null });
        }
    }
    return normalized;
}

export async function createBackup({ folder = null, tag = "", notify = true } = {}) {
    const backupPath = await ensureDataDirectory(folder || getBackupFolder());
    const date = new Date();
    const pad = n => String(n).padStart(2, "0");
    const stamp = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    ].join("-");
    const fileName = `visual-novel-dialogues-${tag ? `${tag}-` : ""}${stamp}.json`;
    const payload = {
        type: `${Constants.ID}.vnData`,
        moduleVersion: game.modules.get(Constants.ID)?.version,
        createdAt: date.toISOString(),
        data: game.settings.get(Constants.ID, "vnData")
    };
    const newFile = new File(
        [JSON.stringify(payload, null, 2)],
        fileName,
        { type: "application/json" }
    );

    await FilePicker.upload("data", backupPath, newFile, {}, { notify: false });
    if (notify) ui.notifications.info(`${game.i18n.localize(`${Constants.ID}.settings.backupCreated`)} ${backupPath}/${fileName}`);
    return `${backupPath}/${fileName}`;
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
