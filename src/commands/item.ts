import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { parse } from "twemoji-parser";
import prisma from "../init/database";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders";
import { countItemOnAuction } from "../utils/functions/economy/auctions";
import {
  calcItemValue,
  getInventory,
  getTotalAmountOfItem,
  selectItem,
} from "../utils/functions/economy/inventory";
import { createUser, userExists } from "../utils/functions/economy/utils";
import { getTagCount } from "../utils/functions/users/tags";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

const cmd = new Command("item", "view information about an item", "money").setAliases(["i"]);

cmd.slashEnabled = true;
cmd.slashData.addStringOption((option) =>
  option
    .setName("item-global")
    .setDescription("item you want to view info for")
    .setAutocomplete(true)
    .setRequired(true),
);

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  const send = async (data: BaseMessageOptions | InteractionReplyOptions) => {
    if (!(message instanceof Message)) {
      let usedNewMessage = false;
      let res;

      if (message.deferred) {
        res = await message.editReply(data).catch(async () => {
          usedNewMessage = true;
          return await message.channel.send(data as BaseMessageOptions);
        });
      } else {
        res = await message.reply(data as InteractionReplyOptions).catch(() => {
          return message.editReply(data).catch(async () => {
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

  if (!(await userExists(message.member))) await createUser(message.member);

  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return send({ embeds: [embed], ephemeral: true });
  }

  if (args.length == 0) {
    return send({ embeds: [new ErrorEmbed("/item <item>")] });
  }

  const selected = selectItem(args.join(" ").toLowerCase());

  if (!selected) {
    return send({ embeds: [new ErrorEmbed(`couldnt find \`${args.join(" ")}\``)] });
  }

  await addCooldown(cmd.name, message.member, 4);

  const embed = new CustomEmbed(message.member).setTitle(`${selected.emoji} ${selected.name}`);

  const desc: string[] = [];

  desc.push(`\`${selected.id}\``);
  desc.push(`\n> ${selected.longDesc}\n`);

  if (selected.booster_desc) {
    desc.push(`*${selected.booster_desc}*`);
  }

  if (!selected.in_crates) {
    desc.push("*cannot be found in crates*");
  }

  if (selected.buy) {
    if (desc[desc.length - 1].endsWith("\n")) {
      desc.push(`**buy** $${selected.buy.toLocaleString()}`);
    } else {
      desc.push(`\n**buy** $${selected.buy.toLocaleString()}`);
    }
  }

  if (selected.sell) {
    if (selected.buy) {
      desc.push(`**sell** $${selected.sell.toLocaleString()}`);
    } else {
      desc.push(`\n**sell** $${selected.sell.toLocaleString()}`);
    }
  }

  const [total, inventory, inAuction, value] = await Promise.all([
    getTotalAmountOfItem(selected.id),
    getInventory(message.member),
    countItemOnAuction(selected.id),
    calcItemValue(selected.id),
  ]);

  if (selected.sell || selected.buy) {
    desc.push(`**worth** $${Math.floor(value).toLocaleString()}`);
  } else {
    desc.push(`\n**worth** $${Math.floor(value).toLocaleString()}`);
  }

  if (total) {
    desc.push(`\n**in world** ${total.toLocaleString()}`);
  }

  if (inAuction) {
    if (total) {
      desc.push(`**in auction** ${inAuction.toLocaleString()}`);
    } else {
      desc.push(`\n**in auction** ${inAuction.toLocaleString()}`);
    }
  }

  if (selected.role) {
    embed.addField(
      "role",
      `\`${selected.role}${
        selected.role == "car"
          ? ` (${selected.speed})`
          : selected.role === "tag"
          ? ` (${(await getTagCount(selected.tagId)).toLocaleString()})`
          : ""
      }\``,
      true,
    );
  }

  const rarityMap = new Map<number, string>();

  rarityMap.set(0, "common");
  rarityMap.set(1, "uncommon");
  rarityMap.set(2, "rare");
  rarityMap.set(3, "very rare");
  rarityMap.set(4, "exotic");
  rarityMap.set(5, "impossible");
  rarityMap.set(6, "literally not possible within your lifetime");

  if (rarityMap.get(selected.rarity)) {
    embed.addField("rarity", `\`${rarityMap.get(selected.rarity)}\``, true);
  }

  if (inventory.find((i) => i.item == selected.id)) {
    embed.setFooter({
      text: `you have ${inventory.find((i) => i.item == selected.id).amount.toLocaleString()} ${
        inventory.find((i) => i.item == selected.id).amount > 1
          ? selected.plural || selected.name
          : selected.name
      }`,
    });
  }

  embed.setDescription(desc.join("\n"));

  let thumbnail: string;

  if (selected.emoji.split(":")[2]) {
    const emojiID = selected.emoji.split(":")[2].slice(0, selected.emoji.split(":")[2].length - 1);

    thumbnail = `https://cdn.discordapp.com/emojis/${emojiID}`;

    if (selected.emoji.split(":")[0].includes("a")) {
      thumbnail = thumbnail + ".gif";
    } else {
      thumbnail = thumbnail + ".png";
    }
  } else {
    try {
      thumbnail = parse(selected.emoji, { assetType: "png" })[0].url;
    } catch {
      /* happy linter */
    }
  }

  embed.setThumbnail(thumbnail);
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("history")
        .setEmoji("📈")
        .setURL("https://nypsi.xyz/item/history/" + selected.id),
    ),
  ];

  if (
    (await prisma.auction.count({ where: { AND: [{ itemId: selected.id }, { sold: true }] } })) <
      5 &&
    (await prisma.offer.count({ where: { AND: [{ itemId: selected.id }, { sold: true }] } })) < 5 &&
    (await prisma.graphMetrics.count({ where: { category: `item-count-${selected.id}` } })) < 5
  ) {
    return await send({ embeds: [embed] });
  }

  return await send({ embeds: [embed], components });
}

cmd.setRun(run);

module.exports = cmd;
