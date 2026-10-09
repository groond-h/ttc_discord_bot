require('dotenv').config();
const alerts = require('./ttc');
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType, escapeMarkdown } = require('discord.js');

/**
 * global variables
 */

let currentStatus = '';

/**
 * function declarations
 */

// helper function to update the status with the global variable currentStatus
function updateStatus(){
    if (!client.user) return;
    if (currentStatus.length === 0 || currentStatus == 'clear'){
        client.user.setPresence({
            activities: [],
            status: 'online',
        });
    }
    else{
        client.user.setPresence({
            activities: [{name: currentStatus, type: ActivityType.Custom}],
            status: 'online',
        });
    }
}

async function updateTTCStatus(){
    try{
        // get the alerts feed
        const alertFeed = await alerts.fetchBusAlerts();
        const alertPriorityInfo = [];
        const { Effect } = GtfsRealtimeBindings.transit_realtime.Alert;

        for (const entity of alertFeed.entity){
            let priorityIndex = 0;
            const alert = entity.alert;  
            const currentDate = Math.floor(Date.now()/1000);
            // check time and type of alert
            if (currentDate < alert.activePeriod?.[0].start.low || currentDate > alert.activePeriod?.[0].end.low){
                priorityIndex = 0; // not even applicable
            }
            else if (alert.effect === Effect.REDUCED_SERVICE || alert.effect === Effect.SIGNIFICANT_DELAYS){
                priorityIndex = 1; // middle priority
            }
            else if (alert.effect === Effect.NO_SERVICE){
                priorityIndex = 2; // highest priority
            }
            else{
                priorityIndex = 0; // ignore edge cases
            }
            alertPriorityInfo.push({id: entity.id, priority: priorityIndex, alertType: alert.effect});
        }

        // get the highest priority alert, but only keep the first one (lazy)
        const highestPriorityAlertInfo = alertPriorityInfo.reduce(
                                        (maxAlert, currentAlert) => currentAlert.priority > maxAlert.priority ? currentAlert : maxAlert,
                                        alertPriorityInfo[0]);
        const highestPriorityAlert = alertFeed.entity?.find((entity) => entity.id === highestPriorityAlertInfo.id);
        
        let statusMessage = '';
        let statusState = '';
        const maxStatusLength = 128;
        // no service (red): 
        // reduced service (idle):
        // all clear (green): 
        
        // for splitting the string properly, removes characters leading up to first ':'
        const tempStatusMessage = highestPriorityAlert.alert.headerText?.translation?.[0]?.text
                                .split(':').slice(1).join(':').trim();
        const alertStatusMessage = tempStatusMessage.length > 128 ? tempStatusMessage.slice(0, maxStatusLength-3) + '...': tempStatusMessage;                           
        switch(highestPriorityAlertInfo.priority){
            case 2:
                statusState = 'dnd';
                statusMessage = alertStatusMessage;
                break;
            case 1:
                statusState = 'idle';
                statusMessage = alertStatusMessage;
                break;
            case 0:
            default:
                statusMessage = '';
                statusState = 'online';
        }
        // set the status depending on the type of alert
        console.log(`Applying status: state: ${statusState}, status: ${statusMessage}`);
        if (!client.user) return;
        client.user.setPresence({
            activities: [{name: statusMessage, type: ActivityType.Custom}],
            status: statusState,
        });
    }
    catch(error){
        console.error('Error:', error);
    }
}

// Initialize client with necessary gateway intents
const client = new Client({
    intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    ],
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and latency!'),
  new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Set the bot status')
    .addStringOption((option) => 
        option
            .setName('status')
            .setDescription('The status to display')
            .setRequired(true)
    ),

];

// Register slash commands with Discord API
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );
    console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
    console.error('Failed to register commands:', error);
    }
}

// Event: Triggered when the bot logs in
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    registerCommands();

    //setInterval(updateStatus, 60 * 1000); // interval of 1 minute
    setInterval(updateTTCStatus, 30 * 1000);
});

// Event: Handle Slash Command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! 🏓 (${latency}ms)`);
    }
    else if (interaction.commandName === 'setstatus') {
    currentStatus = interaction.options.getString('status')
    await interaction.reply(`Set status to: "${currentStatus}"`)
    }
});

// Event: Basic keyword response to standard messages
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === 'hello') {
        message.channel.send(`Hello <@${message.author.id}>!`);
    }
});

// Log the bot in
client.login(process.env.DISCORD_TOKEN);
