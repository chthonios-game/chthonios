var canvas;
var ws;
var mousePosition;
var queue = [];
var x, y;

function init() {
	canvas = document.getElementById('canvas');
	if ("WebSocket" in window) {
		ws = new WebSocket("ws://localhost:1357");
		addEventListeners();
	} else
	{
		// The browser doesn't support WebSocket
		alert("WebSocket NOT supported by your Browser!");
	}
}

function addEventListeners() {
	initMouseListeners();

	initKeyboardListeners();

	initWebSocketListeners();
}

function initMouseListeners(){
	canvas.addEventListener('mousemove', function (evt) {
		mousePosition = getMousePos(canvas, evt);
	}, false);

	canvas.addEventListener('onclick', function (evt) {
		console.log("Mouse is at x:" + mousePosition.x + " y:" + mousePosition.y);
	}, false);
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
	}

	ws.onmessage = function (message)
	{
		console.log('received: %s', message.data);
	};
}
function initKeyboardListeners() {

	if (document.addEventListener)
	{
		document.addEventListener("keydown", keyEvent, false);
		document.addEventListener("keypress", keyEvent, false);
		document.addEventListener("keyup", keyEvent, false);
	}
	else if (document.attachEvent)
	{
		document.attachEvent("onkeydown", keyEvent);
		document.attachEvent("onkeypress", keyEvent);
		document.attachEvent("onkeyup", keyEvent);
	}
	else
	{
		document.onkeydown = keyEvent;
		document.onkeypress = keyEvent;
		document.onkeyup = keyEvent;
	}
}


function keyEvent(e){
	if(!e){
		e = event;
	}
	console.log(e.type+": ", getKeyValueFromCode(e.which));
	return false;
}


function getKeyValueFromCode(code){
	if(code === 'undefined'){
		return 'undefined';
	}
	if (code >= 32 && code < 127){
		return String.fromCharCode(code);
	}
	return code;
}

function sendMessage(msg) {

	if (ws.readyState !== 1) {
		attemptReconnect();
	}
	addToQueue(msg);
	if (ws.readyState === 1) {
		processQueue();
	}
}

function attemptReconnect() {
	if (ws.readyState !== 1) {
		ws = new WebSocket("ws://localhost:1357");
	}
}
function processQueue() {
	if (queue.length > 1) {
		//verifyPosition();
	}
	if (queue.length > 0) {
		for (var i = 0; i < queue.length; i++) {
			var msg = queue.pop();
			console.log("Processing message: " + msg);
			ws.send(msg);
		}
	}
}

function addToQueue(msg) {
	console.log("Queuing message: " + msg);
	queue.push(msg);


}
function doKeyDown(e) {
	//sendMessage(e.key);
}










function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

