class MultiplayerManager {
    constructor() {
        this.players = new Map();
        
        const storedData = localStorage.getItem('blockmodesPlayer');
        this.username = storedData ? JSON.parse(storedData).username : 'Guest';

        this.socket = io("http://localhost:3000", { query: { username: this.username } });
        this.updateInterval = null;
        this.syncInterval = 50;
        this.connected = false;
        
        this.init();
        this.updatePlayersList();
    }

    init() {
        this.socket.on("connect", () => {
            this.updateConnectionStatus(true);
            this.startSync();
            this.updatePlayersList();
        });

        this.socket.on("disconnect", () => {
            this.updateConnectionStatus(false);
            this.stopSync();
        });

        this.socket.on("currentPlayers", players => {
            for (const id in players) {
                if (id === this.socket.id) continue;
                this.addRemotePlayer(id, players[id]);
            }
            this.updatePlayersList();
        });

        this.socket.on("playerJoined", ({ id, data }) => {
            this.addRemotePlayer(id, data);
            this.updatePlayersList();
        });

        this.socket.on("playerMoved", ({ id, data }) => {
            console.log("Player moved:", id, data);
            this.updateRemotePlayer(id, data);
        });

        this.socket.on("playerLeft", id => {
            this.removePlayer(id);
            this.updatePlayersList();
        });
    }

    startSync() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (window.game && window.game.player && this.connected) {
                const pos = window.game.player.position;
                const rot = window.game.player.rotation;
                this.socket.emit("playerUpdate", {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    rotY: rot.y
                });
            }
        }, this.syncInterval);
    }

    stopSync() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    }

    addRemotePlayer(id, data) {
        if (this.players.has(id)) return;
        data = data || {};
        
        if (window.game && window.game.scene) {
            const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
            const color = this.getPlayerColor(id);
            const material = new THREE.MeshLambertMaterial({ color: color });
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.userData.username = data.username || `Player_${id.slice(0, 4)}`;
            
            window.game.scene.add(mesh);
            this.players.set(id, mesh);
            
            if (data.x === undefined) data.x = 0;
            if (data.y === undefined) data.y = 50;
            if (data.z === undefined) data.z = 0;
            if (data.rotY === undefined) data.rotY = 0;
            
            this.updateRemotePlayer(id, data);
        }
    }

    updateRemotePlayer(id, data) {
        const mesh = this.players.get(id);
        if (mesh) {
            mesh.position.set(data.x, data.y, data.z);
            mesh.rotation.y = data.rotY;
        }
    }

    removePlayer(id) {
        const mesh = this.players.get(id);
        if (mesh && window.game && window.game.scene) {
            window.game.scene.remove(mesh);
            this.players.delete(id);
        }
    }

    getPlayerColor(id) {
        const colors = [0xFF5252, 0x4CAF50, 0x2196F3, 0xFFC107, 0x9C27B0, 0xFF9800];
        const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        if (!playersList) return;

        playerCount.textContent = this.players.size + 1;

        let html = `
            <div class="player-item me">
                <div class="player-avatar" style="background: #4CAF50;"></div>
                ${this.username} (You)
            </div>
        `;

        this.players.forEach((mesh, id) => {
            html += `
                <div class="player-item">
                    <div class="player-avatar" style="background: ${this.getPlayerColor(id)};"></div>
                    ${mesh.userData.username}
                </div>
            `;
        });

        playersList.innerHTML = html;
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (statusDot && statusText) {
            this.connected = connected;
            statusDot.className = 'status-dot' + (connected ? '' : ' disconnected');
            statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    dispose() {
        this.stopSync();
        if (this.socket) this.socket.disconnect();
        
        this.players.forEach(mesh => {
            if (window.game && window.game.scene) {
                window.game.scene.remove(mesh);
            }
        });
        this.players.clear();
    }
}

// ===========================================
// GAME MODE SYSTEM
// ===========================================
const GameModes = {
    creative: {
        name: "Creative",
        allowFlying: true,
        breakSpeed: 0,
        placeSpeed: 0,
        startingBlocks: ['grass', 'stone', 'dirt', 'wood', 'leaves', 'sand', 'cactus', 'gold', 'silver'],
        gravity: 0.02,
        jumpForce: 0.15,
        spawnHeight: 50
    },
    survival: {
        name: "Survival",
        allowFlying: false,
        breakSpeed: 500,
        placeSpeed: 200,
        startingBlocks: [],
        hasHealth: true,
        maxHealth: 10,
        gravity: 0.02,
        jumpForce: 0.15,
        spawnHeight: 50
    },
    skyblock: {
        name: "Skyblock",
        allowFlying: false,
        breakSpeed: 500,
        placeSpeed: 200,
        startingBlocks: ['grass', 'stone', 'dirt'],
        hasHealth: true,
        maxHealth: 10,
        gravity: 0.02,
        jumpForce: 0.15,
        spawnHeight: 30,
        customTerrain: 'skyblock'
    },
    parkour: {
        name: "Parkour",
        allowFlying: false,
        breakSpeed: Infinity,
        placeSpeed: Infinity,
        startingBlocks: [],
        hasHealth: false,
        gravity: 0.025,
        jumpForce: 0.18,
        spawnHeight: 20,
        customTerrain: 'parkour'
    },
    battlemodes: {
        name: "BattleModes",
        allowFlying: false,
        breakSpeed: 500,
        placeSpeed: 200,
        startingBlocks: ['grass', 'stone', 'wood'],
        hasHealth: true,
        maxHealth: 10,
        gravity: 0.02,
        jumpForce: 0.15,
        spawnHeight: 50
    },
    // ---- NEW: STRANDED ON ISLAND ----
    stranded: {
        name: "Stranded",
        allowFlying: false,
        breakSpeed: 600,
        placeSpeed: 250,
        startingBlocks: [],
        hasHealth: true,
        maxHealth: 10,
        gravity: 0.02,
        jumpForce: 0.15,
        spawnHeight: 20,
        customTerrain: 'island',
        hasHunger: true,
        maxHunger: 10,
        hasDayNight: true,
        dayLength: 1200,
        startingItems: ['palm_wood', 'coconut']
    }
};

// ===========================================
// BLOCK DEFINITIONS
// ===========================================
const BlockTypes = {
    air:               { name: 'Air',              color: 0x000000, solid: false },
    grass:             { name: 'Grass',             color: 0x4CAF50, solid: true },
    stone:             { name: 'Stone',             color: 0x808080, solid: true },
    dirt:              { name: 'Dirt',              color: 0x8B4513, solid: true },
    wood:              { name: 'Wood',              color: 0xA0522D, solid: true },
    leaves:            { name: 'Leaves',            color: 0x228B22, solid: true },
    sand:              { name: 'Sand',              color: 0xE6C288, solid: true },
    cactus:            { name: 'Cactus',            color: 0x006400, solid: true },
    gold:              { name: 'Gold',              color: 0xFFD700, solid: true, hasTexture: true, texturePath: 'textures/gold.png' },
    silver:            { name: 'Silver',            color: 0xC0C0C0, solid: true, hasTexture: true, texturePath: 'textures/silver.png' },
    graphite:          { name: 'Graphite',          color: 0x444444, solid: true, hasTexture: true, texturePath: 'textures/graphite.png' },
    iron:              { name: 'Iron',              color: 0xEEEEEE, solid: true, hasTexture: true, texturePath: 'textures/iron.png' },
    diamond:           { name: 'Diamond',           color: 0x00FFFF, solid: true, hasTexture: true, texturePath: 'textures/diamond.png' },
    coal:              { name: 'Coal',              color: 0x111111, solid: true, hasTexture: true, texturePath: 'textures/coal.png' },
    grey_concrete:     { name: 'Grey Concrete',     color: 0x959595, solid: true, hasTexture: true, texturePath: 'textures/grey_concrete.png' },
    red_concrete:      { name: 'Red Concrete',      color: 0x8e2020, solid: true, hasTexture: true, texturePath: 'textures/red_concrete.png' },
    black_concrete:    { name: 'Black Concrete',    color: 0x080808, solid: true, hasTexture: true, texturePath: 'textures/black_concrete.png' },
    dark_grey_concrete:{ name: 'Dark Grey Concrete',color: 0x404040, solid: true, hasTexture: true, texturePath: 'textures/dark_grey_concrete.png' },
    // ---- STRANDED ISLAND BLOCKS ----
    palm_wood:         { name: 'Palm Wood',         color: 0xC8A96E, solid: true },
    palm_leaves:       { name: 'Palm Leaves',       color: 0x3DB847, solid: true },
    coconut:           { name: 'Coconut',           color: 0x6B3E26, solid: true },
    coral:             { name: 'Coral',             color: 0xFF6B9D, solid: true },
    water:             { name: 'Water',             color: 0x1A6FBF, solid: false, transparent: true, opacity: 0.7 },
    wet_sand:          { name: 'Wet Sand',          color: 0xD4B483, solid: true },
    dry_sand:          { name: 'Dry Sand',          color: 0xF2D592, solid: true },
    jungle_wood:       { name: 'Jungle Wood',       color: 0x7D5A3C, solid: true },
    jungle_leaves:     { name: 'Jungle Leaves',     color: 0x1E7A2F, solid: true },
    obsidian:          { name: 'Obsidian',          color: 0x1A0A2E, solid: true },
    fire_stone:        { name: 'Fire Stone',        color: 0xFF4500, solid: true },
    bamboo:            { name: 'Bamboo',            color: 0x8DB600, solid: true },
    thatch:            { name: 'Thatch',            color: 0xD4A017, solid: true },
    raft_plank:        { name: 'Raft Plank',        color: 0xC19A6B, solid: true }
};

// ===========================================
// TEXTURE LOADER
// ===========================================
class TextureManager {
    constructor() {
        this.loader = new THREE.TextureLoader();
        this.textures = new Map();
        this.loadTextures();
    }

    loadTextures() {
        Object.entries(BlockTypes).forEach(([key, block]) => {
            if (block.hasTexture && block.texturePath) {
                this.loader.load(
                    block.texturePath,
                    (texture) => {
                        texture.magFilter = THREE.NearestFilter;
                        texture.minFilter = THREE.NearestFilter;
                        this.textures.set(key, texture);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Failed to load texture for ${key}:`, error);
                    }
                );
            }
        });
    }

    getTexture(blockType) {
        return this.textures.get(blockType);
    }

    getMaterial(blockType) {
        // Water gets special transparent material
        if (blockType === 'water') {
            return new THREE.MeshLambertMaterial({
                color: 0x1A6FBF,
                transparent: true,
                opacity: 0.65
            });
        }

        const block = BlockTypes[blockType];
        const texture = this.getTexture(blockType);
        
        if (texture) {
            return new THREE.MeshLambertMaterial({ map: texture });
        } else {
            return new THREE.MeshLambertMaterial({ color: block.color });
        }
    }
}

// ===========================================
// STRANDED MANAGER
// ===========================================
class StrandedManager {
    constructor(game, mode) {
        this.game = game;
        this.mode = mode;
        this.hunger = mode.maxHunger;
        this.dayTime = 0;
        this.dayLength = mode.dayLength || 1200;
        this.day = 1;
        this.isNight = false;
        this.hungerTimer = 0;
        this.hungerInterval = 300;
        this.craftingRecipes = this.defineCraftingRecipes();
        this.discovered = new Set();
        this._keyListener = null;

        this.buildHUD();
        this.setupCraftingUI();
        this.setupEventListeners();
    }

    defineCraftingRecipes() {
        return [
            {
                id: 'shelter',
                name: '🏠 Basic Shelter',
                description: 'A crude shelter for sleeping',
                requires: { palm_wood: 8, thatch: 4 },
                gives: { thatch: 12 },
                icon: '🏠'
            },
            {
                id: 'campfire',
                name: '🔥 Campfire',
                description: 'Provides warmth and light at night',
                requires: { palm_wood: 3, stone: 4 },
                gives: { fire_stone: 1 },
                icon: '🔥'
            },
            {
                id: 'raft',
                name: '🛶 Escape Raft',
                description: 'Your ticket off this island! Requires many resources.',
                requires: { palm_wood: 20, bamboo: 10, thatch: 8 },
                gives: { raft_plank: 5 },
                icon: '🛶',
                isEscape: true
            },
            {
                id: 'fishing_rod',
                name: '🎣 Fishing Rod',
                description: 'Catch fish to restore hunger',
                requires: { bamboo: 3, palm_wood: 1 },
                gives: { bamboo: 1 },
                icon: '🎣'
            },
            {
                id: 'water_filter',
                name: '💧 Water Filter',
                description: 'Turns seawater into drinkable water',
                requires: { stone: 5, sand: 3 },
                gives: { stone: 1 },
                icon: '💧'
            },
            {
                id: 'torch',
                name: '🕯️ Torch',
                description: 'Lights up the dark night',
                requires: { bamboo: 1, palm_wood: 2 },
                gives: { bamboo: 1 },
                icon: '🕯️'
            }
        ];
    }

    buildHUD() {
        const existing = document.getElementById('strandedHUD');
        if (existing) existing.remove();

        const hud = document.createElement('div');
        hud.id = 'strandedHUD';
        hud.innerHTML = `
            <div class="stranded-panel top-panel">
                <div class="stranded-stat">
                    <span class="stat-icon">🌅</span>
                    <span id="dayCounter">Day 1</span>
                </div>
                <div class="stranded-stat">
                    <span class="stat-icon">🕐</span>
                    <span id="timeDisplay">Morning</span>
                </div>
                <div class="stranded-stat objective-stat">
                    <span class="stat-icon">🎯</span>
                    <span id="objectiveText">Survive &amp; Build an Escape Raft</span>
                </div>
            </div>

            <div class="stranded-panel side-panel">
                <div class="stranded-stat">
                    <span class="stat-label">❤️ Health</span>
                    <div class="stranded-bar">
                        <div id="healthBarFill" class="bar-fill health-fill" style="width:100%"></div>
                    </div>
                </div>
                <div class="stranded-stat">
                    <span class="stat-label">🍖 Hunger</span>
                    <div class="stranded-bar">
                        <div id="hungerBarFill" class="bar-fill hunger-fill" style="width:100%"></div>
                    </div>
                </div>
            </div>

            <div class="stranded-panel bottom-hint">
                <span>Press <kbd>C</kbd> to Craft &middot; <kbd>G</kbd> to Forage &middot; Collect resources to escape!</span>
            </div>

            <div id="nightOverlay" class="night-overlay"></div>
            <div id="nightMessage" class="night-message">🌙 Night Falls... Survive until dawn</div>
        `;

        document.body.appendChild(hud);
        this.injectCSS();
    }

    injectCSS() {
        const existing = document.getElementById('strandedStyles');
        if (existing) existing.remove();

        const style = document.createElement('style');
        style.id = 'strandedStyles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Crimson+Pro:wght@400;600&display=swap');

            #strandedHUD {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none;
                z-index: 100;
                font-family: 'Crimson Pro', serif;
            }

            .stranded-panel { position: absolute; pointer-events: auto; }

            .top-panel {
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 24px;
                background: rgba(15, 10, 5, 0.75);
                border: 1px solid rgba(210, 160, 80, 0.4);
                border-radius: 4px;
                padding: 8px 20px;
                backdrop-filter: blur(6px);
            }

            .side-panel {
                top: 50%;
                right: 16px;
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: rgba(15, 10, 5, 0.75);
                border: 1px solid rgba(210, 160, 80, 0.35);
                border-radius: 4px;
                padding: 14px 16px;
                min-width: 160px;
                backdrop-filter: blur(6px);
            }

            .bottom-hint {
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 10, 5, 0.65);
                border: 1px solid rgba(210, 160, 80, 0.25);
                border-radius: 4px;
                padding: 6px 16px;
                font-size: 13px;
                color: rgba(220, 200, 160, 0.85);
                white-space: nowrap;
                backdrop-filter: blur(4px);
            }

            .bottom-hint kbd {
                background: rgba(210, 160, 80, 0.2);
                border: 1px solid rgba(210, 160, 80, 0.5);
                border-radius: 3px;
                padding: 1px 5px;
                font-family: monospace;
                font-size: 11px;
            }

            .stranded-stat {
                display: flex;
                flex-direction: column;
                gap: 4px;
                color: #d4c089;
                font-size: 13px;
            }

            .top-panel .stranded-stat {
                flex-direction: row;
                align-items: center;
                gap: 6px;
                font-size: 14px;
            }

            .objective-stat { color: rgba(255, 200, 80, 0.9); font-style: italic; }
            .stat-icon { font-size: 16px; }
            .stat-label { font-size: 12px; color: rgba(210, 180, 120, 0.8); margin-bottom: 2px; }

            .stranded-bar {
                width: 120px;
                height: 10px;
                background: rgba(0,0,0,0.5);
                border: 1px solid rgba(210,160,80,0.3);
                border-radius: 2px;
                overflow: hidden;
            }

            .bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
            .health-fill { background: linear-gradient(90deg, #c0392b, #e74c3c); }
            .hunger-fill { background: linear-gradient(90deg, #8B4513, #D4A017); }

            .night-overlay {
                position: absolute;
                inset: 0;
                background: radial-gradient(ellipse at center, transparent 30%, rgba(5,5,25,0.7) 100%);
                opacity: 0;
                transition: opacity 3s ease;
                pointer-events: none;
            }
            .night-overlay.active { opacity: 1; }

            .night-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: rgba(180, 200, 255, 0.9);
                font-family: 'Pirata One', cursive;
                font-size: 28px;
                text-shadow: 0 0 20px rgba(100, 130, 255, 0.5);
                opacity: 0;
                transition: opacity 2s ease;
                pointer-events: none;
                letter-spacing: 2px;
            }
            .night-message.visible { animation: nightPulse 3s ease forwards; }

            @keyframes nightPulse {
                0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; }
            }

            /* CRAFTING MODAL */
            #craftingModal {
                position: fixed;
                inset: 0;
                background: rgba(5, 3, 1, 0.85);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 500;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s ease;
            }
            #craftingModal.active { opacity: 1; pointer-events: auto; }

            .crafting-container {
                background: rgba(20, 14, 8, 0.95);
                border: 1px solid rgba(210, 160, 80, 0.5);
                border-radius: 6px;
                padding: 32px;
                width: min(600px, 92vw);
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            }

            .crafting-title {
                font-family: 'Pirata One', cursive;
                font-size: 28px;
                color: #d4a940;
                letter-spacing: 2px;
                margin-bottom: 8px;
                text-align: center;
            }

            .crafting-subtitle {
                color: rgba(200, 170, 100, 0.6);
                font-size: 13px;
                text-align: center;
                margin-bottom: 24px;
                font-style: italic;
            }

            .crafting-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

            .recipe-card {
                background: rgba(35, 22, 10, 0.8);
                border: 1px solid rgba(210, 160, 80, 0.2);
                border-radius: 4px;
                padding: 14px;
                cursor: pointer;
                transition: border-color 0.2s, background 0.2s;
                position: relative;
            }
            .recipe-card:hover { border-color: rgba(210,160,80,0.6); background: rgba(50,32,12,0.8); }
            .recipe-card.craftable { border-color: rgba(80,200,80,0.4); }
            .recipe-card.craftable:hover { border-color: rgba(80,200,80,0.8); background: rgba(20,40,15,0.8); }
            .recipe-card.escape-card { grid-column: span 2; border-color: rgba(255,200,50,0.5); background: rgba(40,30,5,0.9); }

            .recipe-icon { font-size: 24px; margin-bottom: 6px; }
            .recipe-name { font-family: 'Pirata One', cursive; font-size: 16px; color: #d4c089; margin-bottom: 4px; }
            .recipe-desc { font-size: 12px; color: rgba(180,150,100,0.7); margin-bottom: 10px; font-style: italic; }
            .recipe-requires { font-size: 11px; color: rgba(200,170,120,0.8); }
            .req-item { display: inline-block; margin-right: 8px; }
            .req-item.has { color: #7ec850; }
            .req-item.missing { color: #e05050; }

            .craft-btn {
                position: absolute;
                bottom: 10px; right: 10px;
                background: rgba(210,160,80,0.15);
                border: 1px solid rgba(210,160,80,0.4);
                color: #d4a940;
                padding: 4px 10px;
                font-size: 11px;
                font-family: 'Crimson Pro', serif;
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .craft-btn:hover { background: rgba(210,160,80,0.35); }
            .craft-btn:disabled { opacity: 0.4; cursor: not-allowed; }

            .close-crafting {
                position: absolute;
                top: 12px; right: 16px;
                background: none; border: none;
                color: rgba(210,160,80,0.6);
                font-size: 20px; cursor: pointer; line-height: 1;
            }
            .close-crafting:hover { color: #d4a940; }

            /* NOTIFICATIONS */
            #strandedNotifications {
                position: fixed;
                top: 64px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 600;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }

            .strand-notif {
                background: rgba(20, 14, 8, 0.9);
                border: 1px solid rgba(210,160,80,0.5);
                border-radius: 4px;
                padding: 8px 20px;
                color: #d4c089;
                font-family: 'Crimson Pro', serif;
                font-size: 14px;
                text-align: center;
                animation: notifSlide 3.5s ease forwards;
            }

            @keyframes notifSlide {
                0% { opacity:0; transform:translateY(-10px); }
                15% { opacity:1; transform:translateY(0); }
                75% { opacity:1; }
                100% { opacity:0; transform:translateY(-8px); }
            }

            /* ESCAPE SCREEN */
            #escapeScreen {
                position: fixed;
                inset: 0;
                background: rgba(5,3,1,0.92);
                z-index: 900;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: 'Pirata One', cursive;
                color: #d4a940;
                text-align: center;
                gap: 16px;
            }
            #escapeScreen.active { display: flex; }

            .escape-title {
                font-size: 52px;
                letter-spacing: 4px;
                text-shadow: 0 0 40px rgba(210,160,80,0.6);
                animation: escapePulse 2s ease infinite alternate;
            }
            @keyframes escapePulse {
                from { text-shadow: 0 0 20px rgba(210,160,80,0.4); }
                to   { text-shadow: 0 0 60px rgba(210,160,80,0.9); }
            }

            .escape-sub { font-family: 'Crimson Pro', serif; color: rgba(200,180,130,0.8); font-size: 18px; font-style: italic; }
            .escape-stat { font-size: 14px; color: rgba(200,170,100,0.7); }

            .escape-btn {
                margin-top: 24px;
                padding: 12px 32px;
                background: rgba(210,160,80,0.15);
                border: 1px solid rgba(210,160,80,0.6);
                color: #d4a940;
                font-family: 'Pirata One', cursive;
                font-size: 18px;
                letter-spacing: 1px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .escape-btn:hover { background: rgba(210,160,80,0.3); letter-spacing: 2px; }
        `;
        document.head.appendChild(style);
    }

    setupCraftingUI() {
        const notifContainer = document.createElement('div');
        notifContainer.id = 'strandedNotifications';
        document.body.appendChild(notifContainer);

        const modal = document.createElement('div');
        modal.id = 'craftingModal';
        modal.innerHTML = `
            <div class="crafting-container">
                <button class="close-crafting" id="closeCraftingBtn">✕</button>
                <div class="crafting-title">⚓ Island Crafting</div>
                <div class="crafting-subtitle">Combine gathered resources to survive and escape</div>
                <div class="crafting-grid" id="craftingGrid"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const escapeScreen = document.createElement('div');
        escapeScreen.id = 'escapeScreen';
        escapeScreen.innerHTML = `
            <div class="escape-title">⛵ YOU ESCAPED!</div>
            <div class="escape-sub">Against all odds, you built a raft and sailed to safety.</div>
            <div class="escape-stat" id="escapeDays"></div>
            <button class="escape-btn" onclick="window.game.returnToMenu()">Return to Shore</button>
        `;
        document.body.appendChild(escapeScreen);

        document.getElementById('closeCraftingBtn').addEventListener('click', () => this.closeCrafting());
    }

    setupEventListeners() {
        this._keyListener = (e) => {
            if (!this.game.running || this.game.paused) return;
            // C = crafting (avoid conflict with creative inventory Tab)
            if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                this.toggleCrafting();
            }
            // G = forage (F is used for fly toggle)
            if (e.key === 'g' || e.key === 'G') {
                e.preventDefault();
                this.forage();
            }
        };
        document.addEventListener('keydown', this._keyListener);
    }

    toggleCrafting() {
        const modal = document.getElementById('craftingModal');
        if (modal.classList.contains('active')) {
            this.closeCrafting();
        } else {
            this.openCrafting();
        }
    }

    openCrafting() {
        const modal = document.getElementById('craftingModal');
        modal.classList.add('active');
        this.renderCraftingGrid();
        if (this.game.input) this.game.input.exitPointerLock();
    }

    closeCrafting() {
        const modal = document.getElementById('craftingModal');
        modal.classList.remove('active');
        if (this.game.input) this.game.input.requestPointerLock();
    }

    renderCraftingGrid() {
        const grid = document.getElementById('craftingGrid');
        const inventory = this.game.player ? this.game.player.inventory : [];

        const getCount = (type) => {
            const slot = inventory.find(s => s.type === type);
            return slot ? (slot.count === Infinity ? 999 : slot.count) : 0;
        };

        grid.innerHTML = this.craftingRecipes.map(recipe => {
            const reqs = Object.entries(recipe.requires);
            const canCraft = reqs.every(([type, amount]) => getCount(type) >= amount);

            const reqHTML = reqs.map(([type, amount]) => {
                const have = getCount(type);
                const cls = have >= amount ? 'has' : 'missing';
                const blockName = BlockTypes[type] ? BlockTypes[type].name : type;
                return `<span class="req-item ${cls}">${blockName}: ${have}/${amount}</span>`;
            }).join('');

            return `
                <div class="recipe-card ${canCraft ? 'craftable' : ''} ${recipe.isEscape ? 'escape-card' : ''}">
                    <div class="recipe-icon">${recipe.icon}</div>
                    <div class="recipe-name">${recipe.name}</div>
                    <div class="recipe-desc">${recipe.description}</div>
                    <div class="recipe-requires">${reqHTML}</div>
                    <button class="craft-btn"
                            ${canCraft ? '' : 'disabled'}
                            onclick="window.strandedManager.craft('${recipe.id}')">
                        Craft
                    </button>
                </div>
            `;
        }).join('');
    }

    craft(recipeId) {
        const recipe = this.craftingRecipes.find(r => r.id === recipeId);
        if (!recipe || !this.game.player) return;

        const inventory = this.game.player.inventory;
        const getSlot = (type) => inventory.find(s => s.type === type);

        for (const [type, amount] of Object.entries(recipe.requires)) {
            const slot = getSlot(type);
            const have = slot ? (slot.count === Infinity ? 9999 : slot.count) : 0;
            if (have < amount) {
                this.notify(`❌ Not enough ${BlockTypes[type] ? BlockTypes[type].name : type}!`);
                return;
            }
        }

        for (const [type, amount] of Object.entries(recipe.requires)) {
            const slot = getSlot(type);
            if (slot && slot.count !== Infinity) {
                slot.count -= amount;
                if (slot.count <= 0) slot.type = 'air';
            }
        }

        if (recipe.isEscape) {
            this.triggerEscape();
        } else {
            Object.entries(recipe.gives).forEach(([type, amount]) => {
                for (let i = 0; i < amount; i++) {
                    this.game.player.addToInventory(type);
                }
            });
            this.notify(`✅ Crafted: ${recipe.name}`);
        }

        this.game.player.updateHotbarUI();
        this.renderCraftingGrid();
    }

    forage() {
        if (!this.game.player) return;

        const forageLoot = [
            { type: 'coconut',   chance: 0.4, min: 1, max: 2 },
            { type: 'palm_wood', chance: 0.3, min: 1, max: 3 },
            { type: 'bamboo',    chance: 0.2, min: 1, max: 4 },
            { type: 'stone',     chance: 0.3, min: 1, max: 2 },
            { type: 'sand',      chance: 0.5, min: 2, max: 5 },
        ];

        let found = false;
        forageLoot.forEach(item => {
            if (Math.random() < item.chance) {
                const amount = item.min + Math.floor(Math.random() * (item.max - item.min + 1));
                for (let i = 0; i < amount; i++) {
                    this.game.player.addToInventory(item.type);
                }
                found = true;
            }
        });

        this.notify(found ? '🌿 You foraged some resources nearby!' : '🍂 Nothing useful found nearby...');
    }

    update() {
        this.dayTime = (this.dayTime + 1) % this.dayLength;
        const progress = this.dayTime / this.dayLength;

        const wasNight = this.isNight;
        this.isNight = progress > 0.6 && progress < 0.9;

        // Dynamic sky colour
        if (this.game.scene && this.game.renderer) {
            let skyColor;
            if (progress < 0.05 || progress > 0.95) {
                skyColor = 0xF0A050; // Sunrise/Sunset orange
            } else if (this.isNight) {
                skyColor = 0x0A0B2A; // Deep night blue
            } else {
                skyColor = 0x4BBFE3; // Tropical day blue
            }
            this.game.scene.background = new THREE.Color(skyColor);
            this.game.renderer.setClearColor(skyColor);
        }

        const nightOverlay = document.getElementById('nightOverlay');
        const nightMessage = document.getElementById('nightMessage');

        if (nightOverlay) nightOverlay.classList.toggle('active', this.isNight);

        if (!wasNight && this.isNight && nightMessage) {
            nightMessage.classList.add('visible');
            setTimeout(() => nightMessage.classList.remove('visible'), 4000);
        }

        if (wasNight && !this.isNight) {
            this.day++;
            this.notify(`🌅 Day ${this.day} — Keep surviving!`);
        }

        const timeEl = document.getElementById('timeDisplay');
        if (timeEl) {
            if      (progress < 0.1)  timeEl.textContent = 'Sunrise';
            else if (progress < 0.4)  timeEl.textContent = 'Morning';
            else if (progress < 0.55) timeEl.textContent = 'Afternoon';
            else if (progress < 0.65) timeEl.textContent = 'Dusk';
            else if (progress < 0.9)  timeEl.textContent = 'Night';
            else                      timeEl.textContent = 'Dawn';
        }

        const dayEl = document.getElementById('dayCounter');
        if (dayEl) dayEl.textContent = `Day ${this.day}`;

        // Hunger tick
        this.hungerTimer++;
        if (this.hungerTimer >= this.hungerInterval) {
            this.hungerTimer = 0;
            this.hunger = Math.max(0, this.hunger - 1);
            this.updateBars();

            if (this.hunger <= 0 && this.game.player) {
                this.game.player.health = Math.max(0, this.game.player.health - 1);
                this.notify('⚠️ Starving! Find food or press G to forage!');
                if (this.game.player.health <= 0) {
                    this.triggerDeath();
                }
            }
        }
    }

    updateBars() {
        if (!this.game.player) return;
        const maxHealth = this.mode.maxHealth || 10;
        const maxHunger = this.mode.maxHunger || 10;

        const healthPct = (this.game.player.health / maxHealth) * 100;
        const hungerPct = (this.hunger / maxHunger) * 100;

        const hFill  = document.getElementById('healthBarFill');
        const huFill = document.getElementById('hungerBarFill');
        if (hFill)  hFill.style.width  = `${healthPct}%`;
        if (huFill) huFill.style.width = `${hungerPct}%`;
    }

    eatFood(type) {
        const foodValues = { coconut: 3, palm_leaves: 1 };
        const value = foodValues[type];
        if (!value) return false;

        this.hunger = Math.min(this.mode.maxHunger, this.hunger + value);
        this.updateBars();
        this.notify(`🥥 You ate ${BlockTypes[type].name}. Hunger restored!`);
        return true;
    }

    triggerEscape() {
        const screen = document.getElementById('escapeScreen');
        const dayEl  = document.getElementById('escapeDays');
        if (dayEl)   dayEl.textContent = `You survived for ${this.day} days on the island.`;
        if (screen)  screen.classList.add('active');
        if (this.game.input) this.game.input.exitPointerLock();
    }

    triggerDeath() {
        this.notify('💀 You perished on the island... Respawning...');
        setTimeout(() => {
            if (this.game.player) {
                this.game.player.position.set(0, 22, 0);
                this.game.player.health = this.mode.maxHealth;
                this.hunger = this.mode.maxHunger;
                this.updateBars();
            }
        }, 2000);
    }

    notify(text) {
        const container = document.getElementById('strandedNotifications');
        if (!container) return;
        const notif = document.createElement('div');
        notif.className = 'strand-notif';
        notif.textContent = text;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3600);
    }

    dispose() {
        if (this._keyListener) document.removeEventListener('keydown', this._keyListener);

        ['strandedHUD','craftingModal','strandedNotifications','escapeScreen','strandedStyles'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Reset sky to default
        if (this.game.renderer) this.game.renderer.setClearColor(0x87CEEB);
        if (this.game.scene)    this.game.scene.background = null;
    }
}

// ===========================================
// GAME ENGINE CORE
// ===========================================
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        this.input = null;
        this.currentMode = null;
        this.paused = false;
        this.running = false;
        this.multiplayer = null;
        this.textureManager = null;
        this.strandedManager = null;
        
        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupUI();
        this.textureManager = new TextureManager();
        this.setupCreativeInventory();
    }

    setupRenderer() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(50, 100, 50);
        this.scene.add(dirLight);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

        window.addEventListener('resize', () => this.onResize());
    }

    setupUI() {
        const storedData = localStorage.getItem('blockmodesPlayer');
        let username = 'Guest';
        let isLoggedIn = false;

        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                if (data.username) {
                    username = data.username;
                    isLoggedIn = true;
                }
            } catch (e) {
                console.error('Error parsing stored player data');
            }
        }

        const accountDisplay = document.getElementById('accountDisplay');
        const loginLink = document.getElementById('loginLink');
        const logoutBtn = document.getElementById('logoutBtn');

        if (accountDisplay) {
            accountDisplay.querySelector('span').textContent = `Account: ${username}`;
        }

        if (isLoggedIn) {
            if (loginLink) loginLink.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            if (loginLink) loginLink.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('blockmodesPlayer');
                sessionStorage.removeItem('blockmodesPlayer');
                window.location.reload();
            });
        }

        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                this.startGame(mode);
            });
        });

        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('mainMenuBtn').addEventListener('click', () => {
            this.returnToMenu();
        });

        const updatesModal  = document.getElementById('updatesModal');
        const updatesBtn    = document.getElementById('updatesBtn');
        const closeUpdatesBtn = document.getElementById('closeUpdatesBtn');

        updatesModal.classList.add('active');

        updatesBtn.addEventListener('click', () => {
            updatesModal.classList.add('active');
        });

        closeUpdatesBtn.addEventListener('click', () => {
            updatesModal.classList.remove('active');
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && updatesModal.classList.contains('active')) {
                updatesModal.classList.remove('active');
            }
        });
    }

    setupCreativeInventory() {
        const grid = document.getElementById('inventoryGrid');
        grid.innerHTML = '';
        
        Object.entries(BlockTypes).forEach(([type, data]) => {
            if (type === 'air') return;
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.textContent = data.name;
            
            const hexColor = '#' + data.color.toString(16).padStart(6, '0');
            slot.style.backgroundColor = hexColor;
            
            slot.addEventListener('click', () => {
                if (this.player) {
                    this.player.setHotbarSlot(this.player.selectedSlot, type);
                }
            });
            
            grid.appendChild(slot);
        });
    }

    toggleCreativeInventory() {
        const inv = document.getElementById('creativeInventory');
        const isActive = inv.classList.contains('active');
        
        if (isActive) {
            inv.classList.remove('active');
            this.input.requestPointerLock();
        } else {
            inv.classList.add('active');
            this.input.exitPointerLock();
        }
    }

    startGame(modeName) {
        this.currentMode = GameModes[modeName];
        
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('hud').classList.add('active');
        document.getElementById('modeInfo').textContent = `Mode: ${this.currentMode.name}`;

        this.world = new World(this.scene, this.currentMode, this.textureManager);
        this.player = new Player(this.camera, this.currentMode, this.world, this);
        this.input = new InputManager(this.player, this);
        this.multiplayer = new MultiplayerManager();

        // Initialise Stranded mode manager
        if (modeName === 'stranded') {
            window.strandedManager = new StrandedManager(this, this.currentMode);
            this.strandedManager = window.strandedManager;

            // Give starting items
            if (this.currentMode.startingItems) {
                this.currentMode.startingItems.forEach(type => {
                    this.player.addToInventory(type);
                    this.player.addToInventory(type); // give a couple of each
                });
            }
        }

        if (!this.currentMode.hasHealth) {
            document.querySelector('.health-bar').style.display = 'none';
        } else {
            document.querySelector('.health-bar').style.display = 'flex';
        }

        this.running = true;
        this.animate();
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseMenu = document.getElementById('pauseMenu');
        
        if (this.paused) {
            pauseMenu.classList.add('active');
            this.input.exitPointerLock();
        } else {
            pauseMenu.classList.remove('active');
            this.input.requestPointerLock();
        }
    }

    returnToMenu() {
        this.running = false;
        this.paused = false;
        
        if (this.world)      this.world.dispose();
        if (this.input)      this.input.dispose();
        if (this.multiplayer) this.multiplayer.dispose();

        // Clean up stranded manager
        if (this.strandedManager) {
            this.strandedManager.dispose();
            this.strandedManager = null;
            window.strandedManager = null;
        }
        
        document.getElementById('pauseMenu').classList.remove('active');
        document.getElementById('hud').classList.remove('active');
        document.getElementById('mainMenu').classList.remove('hidden');
    }

    animate() {
        if (!this.running) return;

        requestAnimationFrame(() => this.animate());

        if (!this.paused) {
            this.player.update();
            this.world.update(this.player.position);
            this.input.update();

            // Stranded mode tick
            if (this.strandedManager) {
                this.strandedManager.update();
                this.strandedManager.updateBars();
            }
            
            const pos = this.player.position;
            document.getElementById('posInfo').textContent = 
                `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`;
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// ===========================================
// WORLD / CHUNK SYSTEM
// ===========================================
class World {
    constructor(scene, mode, textureManager) {
        this.scene = scene;
        this.mode = mode;
        this.textureManager = textureManager;
        this.chunks = new Map();
        this.chunkSize = 16;
        this.renderDistance = 4;
        this.blockMeshes = new Map();
        
        this.generateInitialWorld();
    }

    generateInitialWorld() {
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                this.generateChunk(x, z);
            }
        }
    }

    generateChunk(cx, cz) {
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) return;

        const chunk = new Array(this.chunkSize);
        for (let x = 0; x < this.chunkSize; x++) {
            chunk[x] = new Array(this.chunkSize);
            for (let z = 0; z < this.chunkSize; z++) {
                chunk[x][z] = new Array(64).fill('air');
                
                if (this.mode.customTerrain === 'skyblock') {
                    this.generateSkyblock(chunk, x, z, cx, cz);
                } else if (this.mode.customTerrain === 'parkour') {
                    this.generateParkour(chunk, x, z, cx, cz);
                } else if (this.mode.customTerrain === 'island') {
                    this.generateIsland(chunk, x, z, cx, cz);
                } else {
                    this.generateTerrain(chunk, x, z, cx, cz);
                }
            }
        }

        if (this.mode.customTerrain === 'island') {
            this.decorateIsland(chunk, cx, cz);
        } else if (!this.mode.customTerrain) {
            this.decorateChunk(chunk, cx, cz);
        }

        this.chunks.set(key, chunk);
        this.renderChunk(cx, cz, chunk);
    }

    generateTerrain(chunk, lx, lz, cx, cz) {
        const wx = cx * this.chunkSize + lx;
        const wz = cz * this.chunkSize + lz;
        
        const biome = Math.sin(wx * 0.005) + Math.sin(wz * 0.005);
        
        let height;
        
        if (biome > -0.2) {
            height = 30 + Math.floor(
                Math.sin(wx * 0.04) * 5 + 
                Math.cos(wz * 0.04) * 5 +
                Math.sin(wx * 0.01 + wz * 0.01) * 10
            );
            
            for (let y = 0; y < height; y++) {
                if (y === height - 1) {
                    chunk[lx][lz][y] = 'grass';
                } else if (y > height - 4) {
                    chunk[lx][lz][y] = 'dirt';
                } else if (Math.random() < 0.02 && y > height - 10) {
                    chunk[lx][lz][y] = 'gold';
                } else {
                    chunk[lx][lz][y] = 'stone';
                }
            }
        } else {
            height = 30 + Math.floor(
                Math.abs(Math.sin(wx * 0.03 + wz * 0.02)) * 10 +
                Math.sin(wx * 0.01) * 5
            );
            
            for (let y = 0; y < height; y++) {
                if (y >= height - 4) {
                    chunk[lx][lz][y] = 'sand';
                } else {
                    chunk[lx][lz][y] = 'stone';
                }
            }
        }
    }

    // ---- ISLAND TERRAIN GENERATOR ----
    generateIsland(chunk, lx, lz, cx, cz) {
        const wx = cx * this.chunkSize + lx;
        const wz = cz * this.chunkSize + lz;
        const dist = Math.sqrt(wx * wx + wz * wz);

        const islandRadius = 30;
        const shoreRadius  = 38;
        const oceanStart   = 45;

        if (dist < islandRadius) {
            // Island interior
            const heightNoise =
                Math.sin(wx * 0.08) * 3 +
                Math.cos(wz * 0.08) * 3 +
                Math.sin(wx * 0.03 + wz * 0.03) * 5 +
                Math.sin((wx + wz) * 0.05) * 2;

            const baseHeight = 18 - (dist / islandRadius) * 4;
            const height = Math.floor(baseHeight + heightNoise);

            for (let y = 0; y <= height; y++) {
                if (y < 5) {
                    chunk[lx][lz][y] = 'stone';
                } else if (y === height) {
                    chunk[lx][lz][y] = 'grass';
                } else if (y > height - 4) {
                    chunk[lx][lz][y] = 'dirt';
                } else {
                    const rand = Math.abs(Math.sin(wx * 31.4 + y * 7.2 + wz * 19.8));
                    if (rand < 0.03 && y > 6) {
                        chunk[lx][lz][y] = 'gold';
                    } else if (rand < 0.06 && y > 4) {
                        chunk[lx][lz][y] = 'stone';
                    } else {
                        chunk[lx][lz][y] = 'dirt';
                    }
                }
            }

            // Fill below sea level with water
            for (let y = 0; y < 12; y++) {
                if (chunk[lx][lz][y] === 'air') {
                    chunk[lx][lz][y] = 'water';
                }
            }

        } else if (dist < shoreRadius) {
            // Beach / shoreline
            const shoreProgress = (dist - islandRadius) / (shoreRadius - islandRadius);
            const beachHeight = Math.floor(13 - shoreProgress * 2);

            for (let y = 0; y < beachHeight; y++) {
                chunk[lx][lz][y] = y < beachHeight - 2 ? 'wet_sand' : 'dry_sand';
            }

            for (let y = beachHeight; y < 12; y++) {
                chunk[lx][lz][y] = 'water';
            }

            const coralRand = Math.abs(Math.sin(wx * 23.7 + wz * 11.3)) % 1;
            if (coralRand < 0.04 && beachHeight > 0 && chunk[lx][lz][beachHeight - 1] === 'dry_sand') {
                if (beachHeight < 64) chunk[lx][lz][beachHeight] = 'coral';
            }

        } else if (dist < oceanStart) {
            for (let y = 0; y < 10; y++) {
                chunk[lx][lz][y] = y < 8 ? 'wet_sand' : 'water';
            }
            for (let y = 10; y < 12; y++) {
                chunk[lx][lz][y] = 'water';
            }
        } else {
            // Deep ocean
            for (let y = 0; y < 10; y++) {
                chunk[lx][lz][y] = 'water';
            }
        }
    }

    decorateIsland(chunk, cx, cz) {
        for (let x = 1; x < this.chunkSize - 1; x++) {
            for (let z = 1; z < this.chunkSize - 1; z++) {
                const wx = cx * this.chunkSize + x;
                const wz = cz * this.chunkSize + z;
                const dist = Math.sqrt(wx * wx + wz * wz);

                if (dist > 28) continue;

                let surfaceY = -1;
                for (let y = 63; y >= 0; y--) {
                    if (chunk[x][z][y] !== 'air') {
                        surfaceY = y;
                        break;
                    }
                }

                if (surfaceY <= 0) continue;
                if (chunk[x][z][surfaceY] !== 'grass') continue;

                const rand = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;

                if (dist > 15 && dist < 28 && rand < 0.06) {
                    this.buildPalmTree(chunk, x, z, surfaceY + 1);
                } else if (dist < 15 && rand < 0.08) {
                    this.buildJungleTree(chunk, x, z, surfaceY + 1);
                } else if (dist < 20 && rand > 0.9) {
                    const bambooH = 3 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < bambooH; i++) {
                        if (surfaceY + 1 + i < 64) chunk[x][z][surfaceY + 1 + i] = 'bamboo';
                    }
                }
            }
        }
    }

    buildPalmTree(chunk, x, z, y) {
        const trunkH = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < trunkH; i++) {
            if (y + i < 64) chunk[x][z][y + i] = 'palm_wood';
        }
        if (y + trunkH - 2 < 64) chunk[x][z][y + trunkH - 2] = 'coconut';

        const top = y + trunkH;
        const fronds = [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]];
        fronds.forEach(([dx, dz]) => {
            const fx = x + dx; const fz = z + dz;
            if (fx >= 0 && fx < this.chunkSize && fz >= 0 && fz < this.chunkSize && top < 64) {
                chunk[fx][fz][top] = 'palm_leaves';
                if (top - 1 >= 0) chunk[fx][fz][top - 1] = 'palm_leaves';
            }
        });
        if (top < 64) chunk[x][z][top] = 'palm_leaves';
    }

    buildJungleTree(chunk, x, z, y) {
        const trunkH = 7 + Math.floor(Math.random() * 4);
        for (let i = 0; i < trunkH; i++) {
            if (y + i < 64) chunk[x][z][y + i] = 'jungle_wood';
        }

        for (let lx = x - 3; lx <= x + 3; lx++) {
            for (let lz = z - 3; lz <= z + 3; lz++) {
                for (let ly = y + trunkH - 2; ly <= y + trunkH + 2; ly++) {
                    if (lx < 0 || lx >= this.chunkSize || lz < 0 || lz >= this.chunkSize || ly >= 64) continue;
                    const d = Math.abs(lx - x) + Math.abs(lz - z);
                    if (d <= 2 || (ly < y + trunkH && d <= 3)) {
                        if (chunk[lx][lz][ly] === 'air') chunk[lx][lz][ly] = 'jungle_leaves';
                    }
                }
            }
        }
    }

    decorateChunk(chunk, cx, cz) {
        for (let x = 2; x < this.chunkSize - 2; x++) {
            for (let z = 2; z < this.chunkSize - 2; z++) {
                const wx = cx * this.chunkSize + x;
                const wz = cz * this.chunkSize + z;
                
                const biome = Math.sin(wx * 0.005) + Math.sin(wz * 0.005);
                
                let surfaceY = -1;
                for (let y = 63; y >= 0; y--) {
                    if (chunk[x][z][y] !== 'air') {
                        surfaceY = y;
                        break;
                    }
                }
                
                if (surfaceY > 0 && surfaceY < 60) {
                    const rand = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;
                    
                    if (biome > -0.2) {
                        if (rand < 0.02) {
                            this.buildTree(chunk, x, z, surfaceY + 1);
                        }
                    } else {
                        if (rand < 0.01) {
                            this.buildCactus(chunk, x, z, surfaceY + 1);
                        }
                    }
                }
            }
        }
    }

    buildTree(chunk, x, z, y) {
        const height = 4 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < height; i++) {
            if (y + i < 64) chunk[x][z][y + i] = 'wood';
        }
        
        for (let lx = x - 2; lx <= x + 2; lx++) {
            for (let lz = z - 2; lz <= z + 2; lz++) {
                for (let ly = y + height - 2; ly <= y + height + 1; ly++) {
                    if (lx >= 0 && lx < this.chunkSize && lz >= 0 && lz < this.chunkSize && ly < 64) {
                        const dist = Math.abs(lx - x) + Math.abs(lz - z);
                        if (dist <= 1 || (ly < y + height && dist <= 2)) {
                            if (chunk[lx][lz][ly] === 'air') {
                                chunk[lx][lz][ly] = 'leaves';
                            }
                        }
                    }
                }
            }
        }
    }

    buildCactus(chunk, x, z, y) {
        const height = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < height; i++) {
            if (y + i < 64) chunk[x][z][y + i] = 'cactus';
        }
    }

    generateSkyblock(chunk, lx, lz, cx, cz) {
        if (cx === 0 && cz === 0 && lx < 5 && lz < 5) {
            chunk[lx][lz][15] = 'grass';
            chunk[lx][lz][14] = 'dirt';
            chunk[lx][lz][13] = 'stone';
            
            if (lx === 2 && lz === 2) {
                chunk[lx][lz][16] = 'wood';
            }
        }
    }

    generateParkour(chunk, lx, lz, cx, cz) {
        const wx = cx * this.chunkSize + lx;
        const wz = cz * this.chunkSize + lz;
        
        if (Math.abs(wx % 8) < 3 && Math.abs(wz % 8) < 3) {
            const platformHeight = 10 + Math.floor(wx / 8) * 2;
            chunk[lx][lz][platformHeight] = 'stone';
        }
    }

    renderChunk(cx, cz, chunk) {
        const group = new THREE.Group();
        const meshCache = new Map();

        for (let x = 0; x < this.chunkSize; x++) {
            for (let z = 0; z < this.chunkSize; z++) {
                for (let y = 0; y < chunk[x][z].length; y++) {
                    const blockType = chunk[x][z][y];
                    if (blockType === 'air') continue;

                    const wx = cx * this.chunkSize + x;
                    const wz = cz * this.chunkSize + z;

                    if (!this.isBlockExposed(wx, y, wz)) continue;

                    const key = blockType;

                    if (!meshCache.has(key)) {
                        const geo = new THREE.BoxGeometry(1, 1, 1);
                        const mat = this.textureManager.getMaterial(blockType);
                        meshCache.set(key, { geo, mat });
                    }

                    const { geo, mat } = meshCache.get(key);
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(wx, y, wz);
                    mesh.userData = { block: blockType, pos: { x: wx, y: y, z: wz } };
                    
                    group.add(mesh);
                    this.blockMeshes.set(`${wx},${y},${wz}`, mesh);
                }
            }
        }

        group.position.set(0, 0, 0);
        this.scene.add(group);
        this.chunks.set(`${cx},${cz}_mesh`, group);
    }

    isBlockExposed(x, y, z) {
        const neighbors = [
            this.getBlock(x + 1, y, z),
            this.getBlock(x - 1, y, z),
            this.getBlock(x, y + 1, z),
            this.getBlock(x, y - 1, z),
            this.getBlock(x, y, z + 1),
            this.getBlock(x, y, z - 1)
        ];
        return neighbors.some(b => b === 'air' || !b);
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= 64) return 'air';
        
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const key = `${cx},${cz}`;
        
        const chunk = this.chunks.get(key);
        if (!chunk) return null;

        const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
        const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

        return chunk[lx][lz][y];
    }

    setBlock(x, y, z, blockType) {
        if (y < 0 || y >= 64) return false;
        
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const key = `${cx},${cz}`;
        
        const chunk = this.chunks.get(key);
        if (!chunk) return false;

        const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
        const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

        chunk[lx][lz][y] = blockType;
        
        const meshKey = `${x},${y},${z}`;
        const existingMesh = this.blockMeshes.get(meshKey);
        if (existingMesh) {
            existingMesh.parent.remove(existingMesh);
            this.blockMeshes.delete(meshKey);
        }

        if (blockType !== 'air') {
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = this.textureManager.getMaterial(blockType);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.userData = { block: blockType, pos: { x, y, z } };
            
            const chunkMesh = this.chunks.get(`${cx},${cz}_mesh`);
            if (chunkMesh) {
                chunkMesh.add(mesh);
                this.blockMeshes.set(meshKey, mesh);
            }
        }

        return true;
    }

    update(playerPos) {}

    dispose() {
        this.chunks.forEach((value, key) => {
            if (key.includes('_mesh')) {
                this.scene.remove(value);
            }
        });
        this.chunks.clear();
        this.blockMeshes.clear();
    }
}

// ===========================================
// PLAYER CONTROLLER
// ===========================================
class Player {
    constructor(camera, mode, world, game) {
        this.camera = camera;
        this.mode = mode;
        this.world = world;
        this.game = game;
        
        this.position = new THREE.Vector3(0, mode.spawnHeight, 0);
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        
        this.viewMode = 0;
        this.createPlayerMesh();
        this.camera.rotation.order = 'YXZ';
        this.camera.position.copy(this.position);
        
        this.grounded = false;
        this.flying = false;
        this.health = mode.hasHealth ? mode.maxHealth : 0;
        this.selectedSlot = 0;

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 10;

        this.inventory = new Array(5).fill(null).map(() => ({ type: 'air', count: 0 }));
        this.setupHotbar();
    }

    createPlayerMesh() {
        const material = new THREE.MeshLambertMaterial({ color: 0x3498db });

        this.mesh = new THREE.Group();

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), material);
        head.position.y = 1.5;
        this.mesh.add(head);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), material);
        body.position.y = 0.9;
        this.mesh.add(body);

        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), material);
        leftArm.position.set(-0.4, 0.9, 0);
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), material);
        rightArm.position.set(0.4, 0.9, 0);
        this.mesh.add(rightArm);

        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), material);
        leftLeg.position.set(-0.15, 0.2, 0);
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), material);
        rightLeg.position.set(0.15, 0.2, 0);
        this.mesh.add(rightLeg);

        this.mesh.visible = false;
        this.game.scene.add(this.mesh);
    }

    toggleView() {
        this.viewMode = (this.viewMode + 1) % 3;
        this.mesh.visible = this.viewMode !== 0;
    }

    setupHotbar() {
        if (this.mode.startingBlocks) {
            this.mode.startingBlocks.forEach((type, i) => {
                if (i < 5) {
                    this.inventory[i] = { 
                        type: type, 
                        count: this.mode.name === 'Creative' ? Infinity : 64 
                    };
                }
            });
        }

        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, i) => {
            slot.addEventListener('click', () => this.selectSlot(i));
        });
        
        this.updateHotbarUI();
    }

    updateHotbarUI() {
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, i) => {
            const item = this.inventory[i];
            if (item.type !== 'air') {
                const countDisplay = item.count === Infinity ? '∞' : item.count;
                slot.textContent = `${BlockTypes[item.type].name} (${countDisplay})`;
                slot.dataset.block = item.type;
            } else {
                slot.textContent = 'Empty';
                slot.dataset.block = 'air';
            }
        });
    }

    addToInventory(blockType) {
        let slotIndex = this.inventory.findIndex(item => item.type === blockType);
        
        if (slotIndex !== -1) {
            if (this.inventory[slotIndex].count !== Infinity) {
                this.inventory[slotIndex].count++;
            }
        } else {
            slotIndex = this.inventory.findIndex(item => item.type === 'air');
            if (slotIndex !== -1) {
                this.inventory[slotIndex] = { type: blockType, count: 1 };
            }
        }
        this.updateHotbarUI();
    }

    setHotbarSlot(index, type) {
        this.inventory[index] = { 
            type: type, 
            count: this.mode.name === 'Creative' ? Infinity : 64 
        };
        this.updateHotbarUI();
    }

    selectSlot(index) {
        this.selectedSlot = index;
        document.querySelectorAll('.hotbar-slot').forEach((slot, i) => {
            slot.classList.toggle('active', i === index);
        });
    }

    update() {
        this.applyPhysics();
        
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;

        if (this.viewMode === 0) {
            this.camera.position.copy(this.position);
            this.camera.rotation.copy(this.rotation);
        } else {
            const distance = 4;
            const height = 1.5;
            const angleOffset = this.viewMode === 1 ? 0 : Math.PI;
            
            const cameraOffset = new THREE.Vector3(0, 0, distance);
            cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y + angleOffset);
            
            this.camera.position.copy(this.position).add(new THREE.Vector3(0, height, 0)).add(cameraOffset);
            this.camera.lookAt(this.position.clone().add(new THREE.Vector3(0, height, 0)));
        }
    }

    applyPhysics() {
        if (!this.flying) {
            this.velocity.y -= this.mode.gravity;
        }

        this.position.add(this.velocity);

        const blockBelow = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y - 1.8),
            Math.floor(this.position.z)
        );

        if (blockBelow && BlockTypes[blockBelow] && BlockTypes[blockBelow].solid) {
            this.grounded = true;
            this.velocity.y = 0;
            this.position.y = Math.ceil(this.position.y - 1.8) + 1.8;
        } else {
            this.grounded = false;
        }

        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
        if (this.flying) this.velocity.y *= 0.9;
    }

    move(direction) {
        const speed = this.flying ? 0.1 : 0.05;
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(this.rotation);

        if (direction === 'forward') this.velocity.add(forward.multiplyScalar(speed));
        if (direction === 'back')    this.velocity.add(forward.multiplyScalar(-speed));
        if (direction === 'left')    this.velocity.add(right.multiplyScalar(-speed));
        if (direction === 'right')   this.velocity.add(right.multiplyScalar(speed));
    }

    jump() {
        if (this.grounded && !this.flying) {
            this.velocity.y = this.mode.jumpForce;
        }
    }

    toggleFly() {
        if (this.mode.allowFlying) {
            this.flying = !this.flying;
            if (this.flying) this.velocity.y = 0;
        }
    }

    breakBlock() {
        const targetBlock = this.getTargetBlock();
        if (targetBlock) {
            const blockType = this.world.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
            if (blockType && blockType !== 'air') {
                if (this.mode.name === 'Survival' || this.mode.name === 'Skyblock' || this.mode.name === 'Stranded') {
                    this.addToInventory(blockType);
                }
                this.world.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, 'air');

                // Stranded: eating food on break
                if (window.strandedManager && (blockType === 'coconut' || blockType === 'palm_leaves')) {
                    window.strandedManager.eatFood(blockType);
                }
            }
        }
    }

    placeBlock() {
        const targetBlock = this.getTargetBlock(true);
        if (targetBlock) {
            const item = this.inventory[this.selectedSlot];
            if (item.type !== 'air' && item.count > 0) {
                if (this.world.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, item.type)) {
                    if (item.count !== Infinity) {
                        item.count--;
                        if (item.count <= 0) {
                            this.inventory[this.selectedSlot] = { type: 'air', count: 0 };
                        }
                        this.updateHotbarUI();
                    }
                }
            }
        }
    }

    getTargetBlock(adjacent = false) {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        const blockMeshes = Array.from(this.world.blockMeshes.values());
        const intersects = this.raycaster.intersectObjects(blockMeshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const p = hit.object.position;
            
            if (adjacent && hit.face) {
                return {
                    x: p.x + hit.face.normal.x,
                    y: p.y + hit.face.normal.y,
                    z: p.z + hit.face.normal.z
                };
            }
            
            return { x: p.x, y: p.y, z: p.z };
        }
        
        return null;
    }
}

// ===========================================
// INPUT MANAGER
// ===========================================
class InputManager {
    constructor(player, game) {
        this.player = player;
        this.game = game;
        this.keys = {};
        this.mouseDown = false;
        this.locked = false;
        
        this.joystickVector = { x: 0, y: 0 };
        this.touchLookStart = { x: 0, y: 0 };
        this.isTouchingLook = false;

        this.setupEventListeners();
        this.setupMobileControls();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup',   (e) => this.onKeyUp(e));
        
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup',   () => this.mouseDown = false);
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('wheel',     (e) => this.onWheel(e));
        
        document.addEventListener('click', () => {
            if (!this.locked &&
                document.getElementById('hud').classList.contains('active') &&
                !document.getElementById('creativeInventory').classList.contains('active') &&
                !document.getElementById('craftingModal')?.classList.contains('active')) {
                this.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement !== null;
        });

        for (let i = 1; i <= 5; i++) {
            document.addEventListener('keydown', (e) => {
                if (e.key === i.toString()) {
                    this.player.selectSlot(i - 1);
                }
            });
        }
    }
    
    setupMobileControls() {
        const joystickZone = document.getElementById('joystickZone');
        const joystickKnob = document.getElementById('joystickKnob');
        
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleJoystick(e.touches[0], joystickZone, joystickKnob);
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleJoystick(e.touches[0], joystickZone, joystickKnob);
        }, { passive: false });

        joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystickVector = { x: 0, y: 0 };
            joystickKnob.style.transform = `translate(-50%, -50%)`;
        }, { passive: false });

        document.getElementById('jumpBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys[' '] = true;
        });
        document.getElementById('jumpBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys[' '] = false;
        });

        document.getElementById('flyBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.player.mode.allowFlying) this.player.toggleFly();
        });

        document.getElementById('breakBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.player.breakBlock();
        });

        document.getElementById('placeBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.player.placeBlock();
        });
        
        document.getElementById('invToggleBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game.toggleCreativeInventory();
        });

        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.mobile-btn') || e.target.closest('.joystick-zone')) return;
            
            const touch = e.changedTouches[0];
            if (touch.clientX > window.innerWidth / 2) {
                this.isTouchingLook = true;
                this.touchLookStart = { x: touch.clientX, y: touch.clientY };
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isTouchingLook) return;
            const touch = Array.from(e.changedTouches).find(t => t.clientX > window.innerWidth / 2);
            if (touch) {
                const dx = touch.clientX - this.touchLookStart.x;
                const dy = touch.clientY - this.touchLookStart.y;
                
                const sensitivity = 0.005;
                this.player.rotation.y -= dx * sensitivity;
                this.player.rotation.x -= dy * sensitivity;
                this.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.rotation.x));
                
                this.touchLookStart = { x: touch.clientX, y: touch.clientY };
            }
        });

        document.addEventListener('touchend', () => {
            this.isTouchingLook = false;
        });
    }

    handleJoystick(touch, zone, knob) {
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDist = rect.width / 2;
        
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        
        this.joystickVector = {
            x: dx / maxDist,
            y: dy / maxDist
        };
    }

    onKeyDown(e) {
        // Don't intercept C/G when crafting modal is open (StrandedManager handles those)
        if (e.key === 'Tab') {
            e.preventDefault();
            if (this.game.currentMode && this.game.currentMode.name === 'Creative') {
                this.game.toggleCreativeInventory();
            }
            return;
        }

        if (e.key === 'Escape') {
            const craftingModal = document.getElementById('craftingModal');
            if (craftingModal && craftingModal.classList.contains('active')) {
                if (window.strandedManager) window.strandedManager.closeCrafting();
                return;
            }
            if (document.getElementById('creativeInventory').classList.contains('active')) {
                this.game.toggleCreativeInventory();
                return;
            }
            this.game.togglePause();
            return;
        }

        if (document.getElementById('creativeInventory').classList.contains('active')) return;

        this.keys[e.key.toLowerCase()] = true;

        if (e.key === 'f' && this.player.mode.allowFlying) {
            this.player.toggleFly();
        }

        if (e.key === 'v') {
            this.player.toggleView();
        }
    }

    onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }

    onMouseDown(e) {
        if (!this.locked) return;
        
        this.mouseDown = true;

        if (e.button === 0) {
            this.player.breakBlock();
        } else if (e.button === 2) {
            e.preventDefault();
            this.player.placeBlock();
        }
    }

    onMouseMove(e) {
        if (!this.locked) return;

        const sensitivity = 0.0012;
        this.player.rotation.y -= e.movementX * sensitivity;
        this.player.rotation.x -= e.movementY * sensitivity;
        this.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.rotation.x));
    }

    onWheel(e) {
        if (!this.locked) return;
        const direction = Math.sign(e.deltaY);
        if (direction > 0) {
            this.player.selectSlot((this.player.selectedSlot + 1) % 5);
        } else if (direction < 0) {
            this.player.selectSlot((this.player.selectedSlot - 1 + 5) % 5);
        }
    }

    requestPointerLock() {
        document.body.requestPointerLock();
    }

    exitPointerLock() {
        document.exitPointerLock();
    }
    
    update() {
        if (this.keys['w']) this.player.move('forward');
        if (this.keys['s']) this.player.move('back');
        if (this.keys['a']) this.player.move('left');
        if (this.keys['d']) this.player.move('right');
        
        if (this.keys[' ']) {
            if (this.player.flying) {
                this.player.velocity.y = 0.3;
            } else {
                this.player.jump();
            }
        }
        if (this.keys['shift'] && this.player.flying) {
            this.player.velocity.y = -0.3;
        }

        if (Math.abs(this.joystickVector.y) > 0.1) {
            this.player.move(this.joystickVector.y < 0 ? 'forward' : 'back');
        }
        if (Math.abs(this.joystickVector.x) > 0.1) {
            this.player.move(this.joystickVector.x < 0 ? 'left' : 'right');
        }
    }

    dispose() {}
}

// ===========================================
// INITIALIZE GAME
// ===========================================
window.game = new Game();

document.addEventListener('contextmenu', e => e.preventDefault());

let lastTime = performance.now();
let frames = 0;
setInterval(() => {
    const now = performance.now();
    const fps = Math.round(frames * 1000 / (now - lastTime));
    document.getElementById('fpsInfo').textContent = fps;
    frames = 0;
    lastTime = now;
}, 1000);

function countFrame() {
    frames++;
    requestAnimationFrame(countFrame);
}
countFrame();