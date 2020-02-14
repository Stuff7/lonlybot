const { app, BrowserWindow, ipcMain, BrowserView } = require("electron")
const { URL } = require("url")

const fetch = require('node-fetch')
const fs = require("fs")
const tmi = require("tmi.js")

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const CLIENT_ID = "zlhbuxnvm01fbq3h0xr8o602lfhln0"
const CLIENT_SECRET = "85uu0g7xeexcq7zf8tf4a0891q7fti"
const REDIRECT_URI = "https://lonlybot.github.io/"
const SCOPE = 
"chat:edit\
 channel:moderate\
 chat:read\
 channel:read:subscriptions\
 user:read:broadcast\
 whispers:read\
 whispers:edit\
 channel_editor\
 bits:read\
 moderation:read\
 analytics:read:extensions\
 analytics:read:games"
let win
let bot
const intvls = []
const timeouts = []
let cfg

try {
	cfg = JSON.parse(fs.readFileSync("./resources/cfg.json", 'utf8'))
}
catch(error) {
	if(error.code == "ENOENT") {
		cfg = {
			autoconnect:true,
			bot:"",
			channel:"",
			timers:{},
			intvl:0,
			run_timers:false,
			access_token:"",
			refresh_token:"",
			editors:{},
			defCmds:{timer:"!timers",intvl:"!intvl"},
		}
		fs.writeFile('./resources/cfg.json',JSON.stringify(cfg),e=>console.log(e))
	}
}


function createWindow () {
	// Create the browser window.
	win = new BrowserWindow({
		backgroundColor: "#0F0E11",
		width: 500,
		height: 700,
		webPreferences: {
			nodeIntegration: true
		}
	})

	// and load the index.html of the app.
	win.loadFile("view/splash/splash.html")
	cfg.autoconnect&&cfg.channel&&cfg.access_token&&cfg.refresh_token&&cfg.bot&&
	connectBot()||
	win.loadFile('view/setup/setup.html')
	win.removeMenu()

	// Open the DevTools.
	//win.webContents.openDevTools()

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		fs.writeFile('./resources/cfg.json',JSON.stringify(cfg),e=>console.log(e))
		win = null
	})
	win.webContents.session.clearStorageData()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow()
	}
})

ipcMain.on("setup-ready",(e,title)=> {
	e.reply("setup-ready", cfg.channel, cfg.bot, cfg.autoconnect)
})
ipcMain.on("setup-done",(e,channel,bot,autoconnect)=> {
	if(cfg.bot.toLowerCase() == bot.toLowerCase()) {
		cfg.bot = bot
		cfg.channel = channel
		cfg.autoconnect = autoconnect
		win.loadFile("view/splash/splash.html")
		connectBot()
		return
	}
	cfg.bot = bot
	cfg.channel = channel
	cfg.autoconnect = autoconnect

	win.loadURL(
		"https://id.twitch.tv/oauth2/authorize"+
				"?force_verify=true"+
				"&response_type=code"+
				`&client_id=${CLIENT_ID}`+
				`&redirect_uri=${REDIRECT_URI}`+
				`&scope=${SCOPE}`)

	let webview = win.webContents

	webview.on("did-navigate",(e,url)=>{
		console.log(`HOST: ${url}`)
		if(url.startsWith("https://lonlybot")) {
			win.loadFile("view/splash/splash.html")
			url = new URL(url)
			let code = url.searchParams.get("code")
			console.log(`CODE: ${code}`)
			if(code) {
				fetch("https://id.twitch.tv/oauth2/token"+
					"?grant_type=authorization_code"+
					`&client_id=${CLIENT_ID}`+
					`&client_secret=${CLIENT_SECRET}`+
					`&code=${code}`+
					`&redirect_uri=${REDIRECT_URI}`, {method:"POST"})
				.then(r=>r.json())
				.then(response=>{
					cfg.access_token = response.access_token
					cfg.refresh_token = response.refresh_token
					connectBot()
					fs.writeFile('./resources/cfg.json',JSON.stringify(cfg),e=>console.log(e))
				})
			}
			else {
				win.loadFile("view/setup/setup.html")
			}
			win.webContents.session.clearStorageData()
		}
	})
})


ipcMain.on("timers-ready",(e,title)=> {
	e.reply("timers-ready", cfg.bot, cfg.timers, cfg.intvl, cfg.run_timers)
})
ipcMain.on("timers-input",(ev,interval)=> {
	console.log(`Changed interval from ${cfg.intvl} to ${interval}`)
	cfg.intvl = interval
})
ipcMain.on("timer-resp-edit",(ev,name,response)=> {
	addTimer(name,response)
})
ipcMain.on("timer-name-edit",(ev,name,og)=> {
	addTimer(name,cfg.timers[og])
	delete cfg.timers[og]
})
ipcMain.on("add-timer",(ev,name,response)=> {
	addTimer(name,response)
	ev.reply("timer-added",cfg.timers)
})
ipcMain.on("del-timer",(ev,name)=> {
	delTimer(name)
})
ipcMain.on("run-timers",(ev,run)=> {
	cfg.run_timers = run
	run&&runTimers()||stopTimers()
})
ipcMain.on("disconnect",()=> {
	bot.disconnect()
})


ipcMain.on("settings",()=> {
	win.loadFile("view/settings/settings.html")
})
ipcMain.on("settings-ready",ev=> {
	ev.reply("settings-ready",Object.keys(cfg.editors).reduce((ids,id)=> ids+=`id=${id}&`,""),cfg.defCmds)
})
ipcMain.on("settings-back",ev=> {
	win.loadFile("view/timers/timers.html")
})
ipcMain.on("add-editor",(ev,name)=> {
	fetch(`https://api.twitch.tv/helix/users?login=${name}`,{headers:{"Client-ID":CLIENT_ID}})
	.then(re=>re.status==200&&re.json()).then(json=>{
		cfg.editors[json.data[0].id] = json.data[0].display_name
		ev.reply("add-editor",json.data[0].id,json.data[0].name)
	})
})
ipcMain.on("del-editor",(ev,id)=> {
	delete cfg.editors[id]
})
ipcMain.on("edit-editor",(ev,id,name)=> {
	delete cfg.editors[id]
	fetch(`https://api.twitch.tv/helix/users?login=${name}`,{headers:{"Client-ID":CLIENT_ID}})
	.then(re=>re.status==200&&re.json()).then(json=>{
		cfg.editors[json.data[0].id] = json.data[0].display_name
	})
})
ipcMain.on("def-cmd",(ev,key,val)=> {
	cfg.defCmds[key] = val
})


function connectBot() {
	fetch("https://id.twitch.tv/oauth2/token"+
		"?grant_type=refresh_token"+
		`&refresh_token=${cfg.refresh_token}`+
		`&client_id=${CLIENT_ID}`+
		`&client_secret=${CLIENT_SECRET}`, {method:"POST"})
			.then(r=>r.json())
			.then(response=>{
				cfg.access_token = response.access_token
				cfg.refresh_token = response.refresh_token
				bot = new tmi.client({
					identity: {
						username: cfg.bot,
						password: `oauth:${cfg.access_token}`
					},
					channels: [
						cfg.channel
					]
				})
				bot.on('message', onMessageHandler)
				bot.on('connected', onConnectedHandler)
				bot.on('disconnected', onDisconnectedHandler)
				bot.connect()
			})
	return true
}

function onMessageHandler(channel, user, msg, self) {
	if(self) return
	console.log(msg)
	let cmd = getCmd(msg)
	let option = {
		create: (name,response)=> {
			addTimer(name,response)
			bot.say(channel,`@${user["display-name"]} -> Added timer "${name}" with response: "${response}"`)
			win.webContents.send("timer-added",cfg.timers)
		},
		delete: name=> {
			delTimer(name)
			bot.say(channel,`@${user["display-name"]} -> Removed timer "${name}"`)
			win.webContents.send("timer-added",cfg.timers)
		},
		intvl: duration=> {
			if(isNaN(duration)) return
			stopTimers()
			cfg.intvl = duration
			win.webContents.send("intvl-upd", cfg.intvl)
			bot.say(channel, `@${user["display-name"]} -> Updated timers interval`)
		}
	}

	if(cfg.editors[user.username] || user.username==cfg.channel) {
		if(cmd.args.length > 1 && cmd.name == cfg.defCmds.timer)
			option[cmd.args[0]]&&option[cmd.args[0]](cmd.args[1],cmd.args.slice(2).reduce((r,arg)=>r+=" "+arg,""))
		
		else if(cmd.args.length && cmd.name == cfg.defCmds.intvl)
			option.intvl(parseInt(cmd.args[0]))
	}
}

function getCmd(msg) {
  msg = msg.split(/\s+/)
  const cmd = {name: msg[0].toLowerCase(), args: msg.slice(1)}
  cmd.msg = cmd.args.reduce((str,w)=>str+=w+' ','').trim()
  return cmd
}

function addTimer(name,resp) {
	cfg.timers[name] = resp
}
function delTimer(name) {
	delete cfg.timers[name]
	fs.writeFile('./resources/cfg.json',JSON.stringify(cfg),e=>console.log(e))
}
function runTimers() {
	let timers = Object.values(cfg.timers)
	let intvl = cfg.intvl*60e3||2e3
	timers.forEach((timer,i)=> {
		timeouts.push(setTimeout(()=> bot.say(`#${cfg.channel}`,timer), i*intvl))
		timeouts.push(setTimeout(()=> 
			intvls.push(setInterval(()=> bot.say(`#${cfg.channel}`,timer), timers.length*intvl)), i*intvl))
	})
	return true
}
function stopTimers() {
	timeouts.forEach(timeout=> clearTimeout(timeout))
	intvls.forEach(intvl=> clearInterval(intvl))
	timeouts.length = intvls.length = 0
	return true
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`)
  win.loadFile("view/timers/timers.html")
  //mainWindow.webContents.send('connection','')
}
function onDisconnectedHandler (reason) {
  console.log(`* Disconnected reason: ${reason}`)
  win.loadFile("view/setup/setup.html")
  //mainWindow.webContents.send('connection',reason)
}