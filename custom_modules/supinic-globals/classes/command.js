/* global sb */
module.exports = (function () {
	"use strict";

	/**
	 * Represents a bot command.
	 * @memberof sb
	 * @type Command
	 */
	return class Command {
		/** @alias {Command} */
		constructor (data) {
			/**
			 * Unique numeric ID.
			 * @type {number}
			 */
			this.ID = data.ID;

			/**
			 * Unique command name.
			 * @type {string}
			 */
			this.Name = data.Name;

			try {
				data.Aliases = eval(data.Aliases) || [];
			}
			catch (e) {
				console.log("Command" + this.ID + " has invalid aliases definition: " + e.toString());
				sb.SystemLogger.send("Command.Error", "Command " + this.Name + " (" + this.ID + ") has invalid aliases definition: " + e.toString() + "\n" + e.stack);
				data.Aliases = [];
			}

			/**
			 * Array of string aliases. Can be empty if none are provided.
			 * @type {string[]}
			 */
			this.Aliases = data.Aliases;

			/**
			 * Command description. Also used for the help command.
			 * @type {string}
			 */
			this.Description = data.Description;

			/**
			 * Command cooldown, in milliseconds.
			 * @type {number}
			 */
			this.Cooldown = data.Cooldown;

			/**
			 * Determines if command is rollbackable.
			 * If true, all sensitive database operations will be handled in a transaction - provided in options object
			 * @type {boolean}
			 */
			this.Rollbackable = data.Rollbackable;

			/**
			 * If true, command result will not be checked for banphrases.
			 * Mostly used for system or simple commands.
			 * @type {boolean}
			 */
			this.Skip_Banphrases = data.Skip_Banphrases;

			/**
			 * If true, command is only accessible to certain users or channels, or their combination.
			 * @type {boolean}
			 */
			this.Whitelisted = data.Whitelisted;

			/**
			 * If not null, specified the response for a whitelisted command when invoked outside of the whitelist.
			 * @type {boolean}
			 */
			this.Whitelist_Response = data.Whitelist_Response;

			/**
			 * If true, command is guaranteed to not reply, and as such, no banphrases, cooldowns or pings are checked.
			 * @type {boolean}
			 */
			this.Read_Only = data.Read_Only;

			/**
			 * If true, any user can "opt-out" from being the target of the command.
			 * @example A user can opt-out from command randomline, and nobody will be able to use it with them as the parameter.
			 * @type {boolean}
			 */
			this.Opt_Outable = data.Opt_Outable;

			/**
			 * If true, the command can be used as a part of the "pipe" command.
			 * @type {boolean}
			 */
			this.Pipeable = data.Pipeable;

			/**
			 * If true, command will attempt to ping its invoker. This also requires the channel to have this option enabled.
			 * @type {boolean}
			 */
			this.Ping = data.Ping;

			try {
				data.Code = eval(data.Code);
			}
			catch (e) {
				console.log("Command" + this.ID + " has invalid code definition: " + e.toString());
				sb.SystemLogger.send("Command.Error", "Command " + this.Name + " (" + this.ID + ") has invalid code definition: " + e.toString() + "\n" + e.stack);
				data.Code = async () => ({ reply: "Command has invalid code definition!" });
			}

			/**
			 * Command code.
			 * @type {Function}
			 */
			this.Code = data.Code;
		}

		/**
		 * Executes the command.
		 * @param {*[]} args
		 * @returns CommandResult
		 */
		execute (...args) {
			return this.Code(...args);
		}

		/** @override */
		static async initialize () {
			await Command.loadData();
			return Command;
		}

		static async loadData () {
			Command.data = (await sb.Query.getRecordset(rs => rs
				.select("*")
				.from("chat_data", "Command")
				.where("Archived = %b", false)
			)).map(record => new Command(record));
		}

		static async reloadData () {
			Command.data = [];
			await Command.loadData();
		}

		/**
		 * Searches for a command, based on its ID, Name or Alias.
		 * Returns immediately if identifier is already a Command.
		 * @param {Command|number|string} identifier
		 * @returns {Command|null}
		 * @throws {sb.Error} If identifier is unrecognized
		 */
		static get (identifier) {
			if (identifier instanceof Command) {
				return identifier;
			}
			else if (typeof identifier === "number") {
				return Command.data.find(command => command.ID === identifier);
			}
			else if (typeof identifier === "string") {
				return Command.data.find(command =>
					command.Name === identifier ||
					command.Aliases.includes(identifier)
				);
			}
			else {
				throw new sb.Error({
					message: "Invalid command identifier type",
					args: { id: identifier, type: typeof identifier }
				});
			}
		}

		/**
		 * Checks if a command exists, and executes it if needed.
		 * @param {Command|number|string} identifier
		 * @param {string[]} argumentArray
		 * @param {Channel|null} channelData
		 * @param {User} userData
		 * @param {Object} options = {} any extra options that will be passed to the command as extra.append
		 * @returns {CommandResult}
		 */
		static async checkAndExecute (identifier, argumentArray, channelData, userData, options = {}) {
			if (!identifier) {
				return {success: false, reason: "no-identifier"};
			}

			const prefixRegex = new RegExp("^\\" + sb.Config.get("COMMAND_PREFIX"));
			identifier = identifier.replace(prefixRegex, "");

			if (!Array.isArray(argumentArray)) {
				throw new sb.Error({
					message: "Command arguments must be provided as an array"
				});
			}

			if (channelData?.Mode === "Inactive" || channelData?.Mode === "Read") {
				return {success: false, reason: "channel-" + channelData.Mode.toLowerCase()};
			}

			const command = Command.get(identifier);
			if (!command) {
				return {success: false, reason: "no-command"};
			}
			// Check for cooldowns, return if it did not pass yet
			if (channelData && !sb.CooldownManager.check(command, userData, channelData)) {
				sb.SystemLogger.send("Command.Fail", command.Name + " - cooldown", channelData, userData);
				return {success: false, reason: "cooldown"};
			}

			// At this point, it is safe to proclaim that the user is using the command,
			// therefore it is also safe to mark them as "well known". They will be loaded on next startup.
			userData.saveProperty("Well_Known", true);

			if (channelData) {
				const filterCheck = sb.Filter.check({
					userID: userData.ID,
					channelID: channelData?.ID ?? null,
					commandID: command.ID
				});

				if (filterCheck) {
					sb.SystemLogger.send("Command.Fail", "Command " + command.ID + " filtered", channelData, userData);
					const reply = (command.Whitelisted && command.Whitelist_Response)
						? command.Whitelist_Response
						: (typeof filterCheck === "string")
							? filterCheck
							: null;

					sb.Runtime.incrementRejectedCommands();

					return {
						success: false,
						reason: "filter",
						reply: reply
					};
				}
			}

			// Check for opted out users
			if (command.Opt_Outable && argumentArray[0]) {
				const optOutCheck = await sb.Filter.checkOptOuts(argumentArray[0], command.ID);

				// If the user is opted out AND the requesting user does not have an override, then return immediately.
				if (optOutCheck && !userData.Data.bypassOptOuts) {
					const reply = (typeof optOutCheck === "string")
						? (await sb.Banphrase.execute(optOutCheck, channelData)).string
						: null;

					sb.CooldownManager.set(command, userData, channelData);

					return {
						success: false,
						reason: "opt-out",
						reply: reply
					};
				}
			}

			const appendOptions = Object.assign({}, options);
			const isPrivateMessage = Boolean(appendOptions.privateMessage);
			if (command.Whitelisted && isPrivateMessage) {
				return {
					success: false,
					reason: "filter",
					reply: "Command is not available in private messages!"
				};
			}

			if (typeof appendOptions.privateMessage !== "undefined") {
				// @todo check if Object.fromEntries(Object.entries.map) is faster than delete
				delete appendOptions.privateMessage;
			}

			/** @type ExtraCommandData */
			let data = {
				platform: options.platform,
				invocation: identifier,
				user: userData,
				channel: channelData,
				command: command,
				transaction: null,
				privateMessage: isPrivateMessage,
				append: appendOptions
			};

			// If the command is rollbackable, set up a transaction.
			// The command must use the connection in transaction - that's why it is passed to data
			if (command.Rollbackable) {
				data.transaction = await sb.Query.getTransaction();
			}

			const args = argumentArray
				.map(i => i.replace(sb.Config.get("WHITESPACE_REGEX"), ""))
				.filter(Boolean);

			/** @type CommandResult */
			let execution;
			try {
				execution = await command.Code(data, ...args);

				sb.Runtime.incrementCommandsCounter();
				sb.SystemLogger.send(
					"Command.Success",
					identifier + (args.length === 0 ? "": (" (" + args.join(" ") + ")")) + " => " + (execution && execution.reply),
					channelData,
					userData
				);

			}
			catch (e) {
				sb.SystemLogger.send(
					"Command.Error",
					identifier + " " + args.join(" ") + "\n" + e.toString() + "\n" + e.stack,
					channelData,
					userData
				);
				console.error(e);

				execution = {success: false, reason: "error", reply: "An internal error occured!"};
			}

			// Read-only commands never reply with anything - banphrases, pings and cooldowns are not checked
			if (command.Read_Only) {
				return {success: !!execution.success};
			}

			if (channelData && (!execution || !execution.meta || !execution.meta.skipCooldown)) {
				sb.CooldownManager.set(command, userData, channelData);
			}

			if (execution && execution.reply) {
				execution.reply = sb.Utils.fixHTML(execution.reply);
				execution.reply = execution.reply.replace(sb.Config.get("WHITESPACE_REGEX"), "");

				if (command.Ping && channelData?.Ping) {
					// @todo maybe {passed, string} is better in case the name is too bad? We'll see later on
					const {string} = await sb.Banphrase.execute(userData.Name, channelData);
					execution.reply = string + ", " + execution.reply;
				}

				const metaSkip = Boolean(execution.meta && execution.meta.skipBanphrases);
				if (!command.Skip_Banphrases && !metaSkip) {
					const {passed, string} = await sb.Banphrase.execute(execution.reply.slice(0, 1000), channelData);
					execution.reply = string;

					if (command.Rollbackable) {
						if (passed) {
							data.transaction.commit();
						}
						else {
							data.transaction.rollback();
						}
					}
				}
				else if (command.Rollbackable) {
					data.transaction.commit();
				}
			}

			return execution;
		}

		/**
		 * Cleans up.
		 */
		static destroy () {
			Command.data = null;
		}
	};
})();

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success If true, result contains reply; if false, result contains error
 * @property {string} [reply] Command result as a string to reply. If not provided, no message should be sent
 * @property {string} [reason] Symbolic description of why command execution failed - used internally
 * @property {Object} [meta] Any other information passed back from the commend execution
 * @property {boolean} [meta.skipCooldown] True if the command requested for no cooldown to be applied
 */

/**
 * @typedef {Object} ExtraCommandData
 * @property {string} invocation Exact command name used for invocation - name or alias
 * @property {User} user Data about the user who invoked the command
 * @property {Channel} channel Data about the channel where the command was invoked
 * @property {Command} command Data about the command being invoked
 * @property {Object} append = {} other platform-specific options
 * @property {?} [transaction] For rollbackable commands, a transaction is set up and later committed/rollbacked.
 * Commands must use this.data.transaction for whatever sbase access should be safeguarded.
 */