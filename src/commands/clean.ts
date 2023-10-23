import { CommandInteraction, Message, PermissionFlagsBits } from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { getPrefix } from "../utils/functions/guilds/utils";
import { isPremium } from "../utils/functions/premium/premium";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";
import dayjs = require("dayjs");

const cmd = new Command(
  "clean",
  "clean up bot commands and responses",
  "moderation",
).setPermissions(["MANAGE_MESSAGES"]);

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    if (message.channel.id != "747056029795221516") return;
    if (!(await isPremium(message.member))) return;
  }

  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return message.channel.send({ embeds: [embed] });
  }

  if (!message.channel.isTextBased()) return;

  if (message.channel.isDMBased()) return;

  await addCooldown(cmd.name, message.member, 15);

  let amount = 50;

  if (args[0] && parseInt(args[0]) && !isNaN(parseInt(args[0]))) {
    amount = parseInt(args[0]);

    if (amount < 2 || amount > 100) amount = 50;
  }

  const [prefix, collected] = await Promise.all([
    getPrefix(message.guild),
    message.channel.messages.fetch({ limit: amount }),
  ]);

  const collecteda = collected.filter(
    (msg) =>
      (msg.author.id == message.client.user.id || msg.content.startsWith(prefix)) &&
      dayjs(msg.createdTimestamp).isAfter(dayjs().subtract(14, "days")),
  );

  await message.channel.bulkDelete(collecteda);
}

cmd.setRun(run);

module.exports = cmd;
