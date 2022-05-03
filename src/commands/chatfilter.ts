import { CommandInteraction, Message, Permissions } from "discord.js"
import { getChatFilter, updateChatFilter, getPrefix } from "../utils/guilds/utils"
import { Command, Categories, NypsiCommandInteraction } from "../utils/models/Command"
import { ErrorEmbed, CustomEmbed } from "../utils/models/EmbedBuilders.js"

const cmd = new Command("chatfilter", "change the chat filter for your server", Categories.ADMIN)
    .setAliases(["filter"])
    .setPermissions(["MANAGE_SERVER"])

/**
 * @param {Message} message
 * @param {Array<String>} args
 */
async function run(message: Message | (NypsiCommandInteraction & CommandInteraction), args: Array<string>) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
        if (message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
            return message.channel.send({ embeds: [new ErrorEmbed("you need the `manage server` permission")] })
        }
        return
    }

    let filter = getChatFilter(message.guild)

    const prefix = getPrefix(message.guild)

    if (args.length == 0) {
        const embed = new CustomEmbed(message.member, false, "`" + filter.join("`\n`") + "`")
            .setTitle("current chat filter")
            .setFooter(`use ${prefix}filter (add/del/+/-) to modify the filter`)

        if (filter.length == 0) {
            embed.setDescription("`❌` empty chat filter")
        }

        return message.channel.send({ embeds: [embed] })
    }

    if (args[0].toLowerCase() == "add" || args[0].toLowerCase() == "+") {
        if (args.length == 1) {
            return message.channel.send({
                embeds: [
                    new ErrorEmbed(`${prefix}filter add/+ <word> | cAsInG doesn't matter, it'll be filtered either way`),
                ],
            })
        }

        const word = args[1]
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[^A-z0-9\s]/g, "")

        if (word == "" || word == " ") {
            return message.channel.send({ embeds: [new ErrorEmbed("word must contain letters or numbers")] })
        }

        if (filter.indexOf(word) > -1) {
            const embed = new CustomEmbed(message.member, false, "❌ `" + word + "` already exists in the filter")
                .setTitle("chat filter")
                .setFooter(`you can use ${prefix}filter to view the filter`)

            return message.channel.send({ embeds: [embed] })
        }

        filter.push(word)

        if (filter.join("").length > 1000) {
            filter.splice(filter.indexOf(word), 1)

            const embed = new CustomEmbed(
                message.member,
                true,
                `❌ filter has exceeded the maximum size - please use *${prefix}filter del/-* or *${prefix}filter reset*`
            ).setTitle("chat filter")

            return message.channel.send({ embeds: [embed] })
        }

        updateChatFilter(message.guild, filter)

        const embed = new CustomEmbed(message.member, true, "✅ added `" + word + "` to the filter").setTitle("chat filter")
        return message.channel.send({ embeds: [embed] })
    }

    if (args[0].toLowerCase() == "del" || args[0].toLowerCase() == "-") {
        if (args.length == 1) {
            return message.channel.send({ embeds: [new ErrorEmbed(`${prefix}filter del/- <word>`)] })
        }

        const word = args[1]
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[^A-z0-9\s]/g, "")

        if (filter.indexOf(word) > -1) {
            filter.splice(filter.indexOf(word), 1)
        } else {
            const embed = new CustomEmbed(message.member, false, "❌ `" + word + "` not found in the filter")
                .setTitle("chat filter")
                .setFooter(`you can use ${prefix}filter to view the filter`)

            return message.channel.send({ embeds: [embed] })
        }

        updateChatFilter(message.guild, filter)

        const embed = new CustomEmbed(message.member, false, "✅ removed `" + word + "` from the filter")
            .setTitle("chat filter")
            .setFooter(`you can use ${prefix}filter reset to reset the filter`)

        return message.channel.send({ embeds: [embed] })
    }

    if (args[0].toLowerCase() == "reset") {
        filter = []

        updateChatFilter(message.guild, filter)

        const embed = new CustomEmbed(message.member, false, "✅ filter has been reset").setTitle("chat filter")

        return message.channel.send({ embeds: [embed] })
    }
}

cmd.setRun(run)

module.exports = cmd
