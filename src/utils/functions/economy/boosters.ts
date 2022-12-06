import { GuildMember } from "discord.js";
import prisma from "../../../init/database";
import redis from "../../../init/redis";
import { CustomEmbed } from "../../../models/EmbedBuilders";
import { Booster } from "../../../types/Economy";
import Constants from "../../Constants";
import { addNotificationToQueue, getDmSettings } from "../users/notifications";
import { getItems } from "./utils";
import _ = require("lodash");

async function checkBoosters(member: string | GuildMember, boosters: Map<string, Booster[]>) {
  let userId: string;
  if (member instanceof GuildMember) {
    userId = member.user.id;
  } else {
    userId = member;
  }

  const expired = new Map<string, number>();

  for (const key of boosters.keys()) {
    const boosters2 = boosters.get(key);
    const newBoosters: Booster[] = [];

    for (const booster of boosters2) {
      if (booster.expire <= Date.now()) {
        await prisma.booster.delete({
          where: {
            id: booster.id,
          },
        });

        if (expired.has(booster.boosterId)) {
          expired.set(booster.boosterId, expired.get(booster.boosterId) + 1);
        } else {
          expired.set(booster.boosterId, 1);
        }

        boosters2.splice(boosters2.indexOf(booster), 1);

        if (boosters2.length == 0) {
          boosters.delete(key);
        } else {
          boosters.set(key, boosters2);
        }
      } else {
        newBoosters.push(booster);
      }
    }

    if (newBoosters.length > 0) {
      boosters.set(key, newBoosters);
    } else {
      boosters.delete(key);
    }
  }

  if (expired.size != 0) {
    await redis.del(`${Constants.redis.cache.economy.BOOSTERS}:${userId}`);
    if ((await getDmSettings(userId)).booster) {
      const embed = new CustomEmbed()
        .setColor(Constants.TRANSPARENT_EMBED_COLOR)
        .setFooter({ text: "/settings me notifications" });

      let desc = "";
      let text = "";
      let total = 0;
      const items = getItems();

      for (const expiredBoosterId of Array.from(expired.keys())) {
        total += expired.get(expiredBoosterId);

        if (expiredBoosterId == "steve") {
          const earned = parseInt((await redis.get(`${Constants.redis.nypsi.STEVE_EARNED}:${userId}`)) || "0");
          await redis.del(`${Constants.redis.nypsi.STEVE_EARNED}:${userId}`);

          desc += `\`${expired.get(expiredBoosterId)}x\` ${items[expiredBoosterId].emoji} ${
            items[expiredBoosterId].name
          } (earned $${earned.toLocaleString()})\n`;
        } else {
          desc += `\`${expired.get(expiredBoosterId)}x\` ${items[expiredBoosterId].emoji} ${items[expiredBoosterId].name}\n`;
        }
      }

      embed.setHeader(`expired booster${total > 1 ? "s" : ""}:`);
      embed.setDescription(desc);

      if (total == 1) {
        text = `your ${items[Array.from(expired.keys())[0]].name} ${
          items[Array.from(expired.keys())[0]].name.endsWith("booster") ? "" : "booster "
        }has expired`;
      } else {
        text = `${total} of your boosters have expired`;
      }

      if (member instanceof GuildMember) {
        await member.send({ embeds: [embed], content: text });
      } else {
        await addNotificationToQueue({
          memberId: userId,
          payload: {
            content: text,
            embed: embed,
          },
        });
      }
    }
  }

  return boosters;
}

export async function getBoosters(member: GuildMember | string): Promise<Map<string, Booster[]>> {
  let id: string;
  if (member instanceof GuildMember) {
    id = member.user.id;
  } else {
    id = member;
  }

  const cache = await redis.get(`${Constants.redis.cache.economy.BOOSTERS}:${id}`);

  if (cache) {
    if (_.isEmpty(JSON.parse(cache))) return new Map();

    const map = new Map<string, Booster[]>(Object.entries(JSON.parse(cache)));

    return await checkBoosters(member, map);
  }

  const query = await prisma.booster.findMany({
    where: {
      userId: id,
    },
    select: {
      boosterId: true,
      expire: true,
      id: true,
    },
  });

  let map = new Map<string, Booster[]>();

  query.forEach((i) => {
    if (map.has(i.boosterId)) {
      map.get(i.boosterId).push({
        boosterId: i.boosterId,
        expire: i.expire.getTime(),
        id: i.id,
      });
    } else {
      map.set(i.boosterId, [
        {
          boosterId: i.boosterId,
          expire: i.expire.getTime(),
          id: i.id,
        },
      ]);
    }
  });

  map = await checkBoosters(member, map);

  await redis.set(`${Constants.redis.cache.economy.BOOSTERS}:${id}`, JSON.stringify(Object.fromEntries(map)));
  await redis.expire(`${Constants.redis.cache.economy.BOOSTERS}:${id}`, 300);

  return map;
}

export async function addBooster(member: GuildMember | string, boosterId: string) {
  let id: string;
  if (member instanceof GuildMember) {
    id = member.user.id;
  } else {
    id = member;
  }

  const items = getItems();

  await prisma.booster.create({
    data: {
      boosterId: boosterId,
      expire: new Date(Date.now() + items[boosterId].boosterEffect.time * 1000),
      userId: id,
    },
  });

  await redis.del(`${Constants.redis.cache.economy.BOOSTERS}:${id}`);
}
