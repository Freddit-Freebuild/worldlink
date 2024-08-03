const Discord = require("discord.js");
const winston = require('winston');

const logFileName = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0] + '.log'

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `[${info.timestamp}] [${info.level}] ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/' + logFileName })
    ]
});
 
const bot = new Discord.Client({ 
    intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.MessageContent,
		Discord.GatewayIntentBits.GuildMembers,

    ],
    partials: [
        Discord.Partials.Channel, 
        Discord.Partials.Message
    ] 
});

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const channels = config.channel_webhooks;
const bot_whitelist = config.bot_whitelist;

const webhooks = {}

const presence_text = '';   // presence status text

bot.on('ready', async () => {
    bot.user.setPresence({ status: 'online', game: { name: presence_text }})

    for (const [channel_id, webhook_url] of Object.entries(channels)) {
        webhooks[channel_id] = new Discord.WebhookClient({ url: webhook_url })
    }
    
    logger.info(`Logged in as ${bot.user.username}`);
});
 
bot.on('messageCreate', (msg) => {
    if (msg.webhookId) return;
    if (msg.author.bot && !bot_whitelist.includes(msg.author.id)) return;
    if (!(Object.keys(channels).includes(msg.channel.id))) return;

    logger.info(`<${msg.author.tag}> ` + msg.content)

    let msg_to_send = ""
    let msg_is_embed = false
    if (msg.embeds.length > 0) {
        msg_is_embed = true
    }

    if (!msg_is_embed) {
        const attachment = msg.attachments.first();
        msg_to_send = {
            content: msg.content + (attachment ? " " + attachment.url : ""),
            username: msg.author.displayName,
            avatarURL: msg.author.displayAvatarURL()
        }
    } else {
        msg_to_send = {
            embeds: msg.embeds,
            username: msg.author.displayName,
            avatarURL: msg.author.displayAvatarURL()
        }
    }

    for (const [channel_id, webhook] of Object.entries(webhooks)) {
        if (msg.channel.id === channel_id) continue;

        webhook.send(msg_to_send)
            .catch((err) => logger.error(`Failed to send message to ${msg.channel.name}: ${err}`))
    }
});

bot.login(config.bot_token);
