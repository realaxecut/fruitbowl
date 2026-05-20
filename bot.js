require('dotenv').config({ path: '.env.local' });
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  client.user.setPresence({
    status: 'online',
  });
});

client.login(process.env.DISCORD_BOT_TOKEN);
