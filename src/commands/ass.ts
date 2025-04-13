import {
  BaseMessageOptions,
  CommandInteraction,
  GuildMember,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
} from "discord.js";
import { Command, NypsiCommandInteraction, NypsiMessage } from "../models/Command";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders.js";
import { addProgress } from "../utils/functions/economy/achievements";
import { getMember } from "../utils/functions/member";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

const cache = new Map<string, string>();

const values = [
  "flat as a pancake.",
  "HOLLYYYYYY LAY THAT THING ON MY FACE RIGHT NOW",
  "i bet it jiggles",
  "can i spank it?",
  "dump truck",
  "damn you're an ironing board",
  "volumptuous",
  "I WANNA EAT IT",
  "let me bite.",
  "hahahahhahha there's nothing there",
];

const cmd = new Command("ass", "accurate prediction of your ass size", "fun").setAliases([
  "butt",
  "bum",
  "booty",
]);

cmd.slashEnabled = true;
cmd.slashData.addUserOption((option) =>
  option.setName("user").setDescription("how big is your ass"),
);

async function run(
  message: NypsiMessage | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  const send = async (data: BaseMessageOptions | InteractionReplyOptions) => {
    if (!(message instanceof Message)) {
      let usedNewMessage = false;
      let res;

      if (message.deferred) {
        res = await message.editReply(data as InteractionEditReplyOptions).catch(async () => {
          usedNewMessage = true;
          return await message.channel.send(data as BaseMessageOptions);
        });
      } else {
        res = await message.reply(data as InteractionReplyOptions).catch(() => {
          return message.editReply(data as InteractionEditReplyOptions).catch(async () => {
            usedNewMessage = true;
            return await message.channel.send(data as BaseMessageOptions);
          });
        });
      }

      if (usedNewMessage && res instanceof Message) return res;

      const replyMsg = await message.fetchReply();
      if (replyMsg instanceof Message) {
        return replyMsg;
      }
    } else {
      return await message.channel.send(data as BaseMessageOptions);
    }
  };

  if (await onCooldown(cmd.name, message.member)) {
    const res = await getResponse(cmd.name, message.member);

    if (res.respond) send({ embeds: [res.embed], ephemeral: true });
    return;
  }

  await addCooldown(cmd.name, message.member, 5);

  let member: GuildMember;

  if (args.length == 0) {
    member = message.member;
  } else {
    member = await getMember(message.guild, args.join(" "));

    if (!member) {
      return send({ embeds: [new ErrorEmbed("invalid user")] });
    }
  }

  let value: string;

  if (cache.has(member.user.id)) {
    value = cache.get(member.user.id);
  } else {
    value = values[Math.floor(Math.random() * values.length)];
    cache.set(member.user.id, value);

    setTimeout(() => {
      cache.delete(member.user.id);
    }, 60 * 1000);
  }

  const embed = new CustomEmbed(message.member)
    .setHeader("ass determiner", member.user.avatarURL())
    .setDescription(member.user.toString() + `\n${value}`);

  send({ embeds: [embed] });

  addProgress(message.author.id, "unsure", 1);
}

cmd.setRun(run);

module.exports = cmd;
