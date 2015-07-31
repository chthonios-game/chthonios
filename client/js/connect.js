var canvas;
var ws;
var mousePosition;
var queue;
var x, y;
var uuid;
var stage;
var avatar;
var others;

function init() {
    // Get the canvas object
    canvas = document.getElementById('canvas');
    stage = new createjs.Stage(canvas);
    avatar = {x: 0, y: 0};
    others = {};

    avatar.x = Math.round((window.innerWidth / 2) / 32);
    avatar.y = Math.round((window.innerHeight / 2) / 32);

    // Get the UUID of the user
    getUUIDFromCookie();

    // Reset/prime the queue
    resetQueue();


    if ("WebSocket" in window) {
        // Open the websocket
        newWebSocketConnection();

        // Register event listeners
        addEventListeners();

        // Resize the window for the first time
        resizeCanvas();

        // Do initial map draw
        drawCanvasBackground();
    } else
    {
        // Alert the user that their browser isn't supported
        alert("Your browser doesn't support WebSocket\nPlease download the latest version of\nGoogle Chrome or Mozilla Firefox to play");
    }
}

function addEventListeners() {
    initMouseListeners();

    initKeyboardListeners();

    initWebSocketListeners();

    initCreateJSTickHandler();

    initWindowResizeListener();
}

function initWindowResizeListener() {
    if (window.addEventListener) {
        window.addEventListener('resize', resizeCanvas, false);
    } else if (window.attachEvent) {
        window.attachEvent('onresize', resizeCanvas);
    } else {
        window.onresize = resizeCanvas;
    }
}

function initCreateJSTickHandler() {
    createjs.Ticker.addEventListener("tick", function () {
        stage.update();
        if (Math.floor(createjs.Ticker.getTicks() % 20) === 0) {
            processQueue();
            drawOtherPlayers();
        }
    });
}
function drawCanvasBackground() {
    var width = Math.round(canvas.offsetWidth / 32) + 1;
    var height = Math.round(canvas.offsetHeight / 32) + 1;

    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var tile = new createjs.Bitmap('tiles/environment/Soil.png');
            tile.x = x * 32;
            tile.y = y * 32;
            stage.addChild(tile);
        }
    }
}
function drawPlayer() {
    var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
    tile.x = avatar.x * 32;
    tile.y = avatar.y * 32;
    if (avatar.tileID !== null && typeof avatar.tileID !== 'undefined') {
        stage.removeChildAt(avatar.tileID);
    }
    stage.addChild(tile);
    avatar.tileID = stage.getChildIndex(tile);
}
function drawOtherPlayers() {
    for (var id in others) {
        var tile = new createjs.Bitmap('tiles/environment/Tower1.png');
        tile.x = others[id].x * 32;
        tile.y = others[id].y * 32;
        tile.name = id;
        if (others[id].tileID !== null && typeof others[id].tileID !== 'undefined') {
            stage.removeChildAt(others[id].tileID);
        }
        stage.addChild(tile);
        others[id].tileID = stage.numChildren;
    }
}
function resizeCanvas() {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (ws.readyState === 1) {
            processQueue();
        }
        drawCanvasBackground();
        drawPlayer();
    }
}

function initMouseListeners() {
    if (canvas.addEventListener) {
        canvas.addEventListener('click', mouseEvent, false);
        canvas.addEventListener('contextmenu', mouseEvent, false);
    } else if (canvas.attachEvent) {
        canvas.attachEvent('onclick', mouseEvent);
        canvas.attachEvent('oncontextmenu', mouseEvent);
    } else {
        canvas.onclick = mouseEvent;
        canvas.oncontextmenu = mouseEvent;
    }
}
function mouseEvent(e) {
    if (!e) {
        e = event;
    }
    e.preventDefault();
    var click = {
        x: ((e.clientX - canvas.getBoundingClientRect().left) / 32).toFixed(1),
        y: ((e.clientY - canvas.getBoundingClientRect().top) / 32).toFixed(1)
    };
    sendMessage("click", click);
}
function getMousePos(e) {
    if (!e) {
        e = event;
    }
    return {
        x: e.clientX - canvas.getBoundingClientRect().left,
        y: e.clientY - canvas.getBoundingClientRect().top
    };
}

function initKeyboardListeners() {

    if (document.addEventListener)
    {
        document.addEventListener("keydown", keyEvent, false);
        document.addEventListener("keypress", keyEvent, false);
        document.addEventListener("keyup", keyEvent, false);
    } else if (document.attachEvent) {
        document.attachEvent("onkeydown", keyEvent);
        document.attachEvent("onkeypress", keyEvent);
        document.attachEvent("onkeyup", keyEvent);
    } else {
        document.onkeydown = keyEvent;
        document.onkeypress = keyEvent;
        document.onkeyup = keyEvent;
    }
}
function keyEvent(e) {
    if (!e) {
        e = event;
    }
    if (e.type === 'keydown') {
        if (e.keyIdentifier === 'Up' || e.keyIdentifier === 'Down' || e.keyIdentifier === 'Left' || e.keyIdentifier === 'Right') {
            sendMessage("key", e.keyIdentifier);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            sendMessage("key", e.key.substring(5));
        } else if (e.which < 32) {
            sendMessage("key", getKeyValueFromCode(e.which));
        }
    } else if (e.which >= 32 && e.type === 'keypress') {
        sendMessage("key", getKeyValueFromCode(e.which));
    }
}
function getKeyValueFromCode(code) {
    if (code === 'undefined') {
        return 'undefined';
    }
    if (code >= 32 && code < 127) {
        return String.fromCharCode(code);
    }
    return code;
}

function initWebSocketListeners() {
    ws.onopen = function () {
        console.log('Socket open');
    };

    ws.onclose = function () {
        console.log('Socket closed');
    };

    ws.onerror = function (err) {
        console.log("Error: " + err);
    };

    ws.onmessage = function (message)
    {
        var data = JSON.parse(message.data);
        updatePlayer(data.x, data.y);
        if (data.other !== null && typeof data.other !== 'undefined') {
            updateOtherPlayers(data.other);
        }
    };
}
function updateOtherPlayers(otherPlayerData) {
    for (var id in otherPlayerData) {
        if (others[id] !== null && typeof others[id] !== 'undefined') {
            others[id].x = otherPlayerData[id].x;
            others[id].y = otherPlayerData[id].y;
        } else {
            others[id] = otherPlayerData[id];
        }
    }
}
function updatePlayer(x, y) {
    avatar.x = x;
    avatar.y = y;
    drawPlayer();
}
function sendMessage(key, value) {
    if (ws.readyState !== 1) {
        if (ws.readyState !== 1) {
            newWebSocketConnection();
        }
    }
    addToQueue(key, value);
    if (ws.readyState === 1) {
        processQueue();
    }
}
function newWebSocketConnection() {
    ws = new WebSocket("ws://localhost:1357");
}
function addToQueue(key, value) {
    queue[key] = value;
}
function processQueue() {
    ws.send(JSON.stringify(queue));
    if (ws.readyState === 1) {
        resetQueue();
    }
}
function resetQueue() {
    queue = {uuid: uuid};
}

function generateUUID() {
    var d = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function getUUIDFromCookie() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var values = cookies[i].trim().split('=');
        if (values[0] === 'uuid') {
            uuid = values[1];
        }
    }
    if (uuid === null || typeof uuid === 'undefined') {
        uuid = generateUUID();
        document.cookie = "uuid=" + uuid;
    }
}