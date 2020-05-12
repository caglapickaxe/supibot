CREATE TABLE IF NOT EXISTS `chat_data`.`Command` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Name` VARCHAR(50) NOT NULL,
  `Aliases` text DEFAULT NULL COMMENT 'JSON array of strings that will be this command''s aliases.',
  `Flags` SET('rollback','system','banphrase-skip','whitelist','read-only','opt-out','block','ping','pipe') DEFAULT NULL,
  `Description` VARCHAR(300) DEFAULT NULL,
  `Cooldown` INT(11) unsigned NOT NULL DEFAULT 0 COMMENT 'Command cooldown given in milliseconds',
  `Rollbackable` TINYINT(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, the command will be given a transaction in its context. All database operations must be completed within that transaction. If the command fails to be sent, the transaction will be automatically rolled back.',
  `System` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, the command will not be shown in the command list, but is still executable.',
  `Skip_Banphrases` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, the command will skip all banphrases. Use sparingly (!) and only in cases where it''s almost obvious no banphrases should be fired.',
  `Whitelisted` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, nobody will be able to execute this command asides from users who have a Whitelist Filter set up for this command.',
  `Whitelist_Response` varchar(300) DEFAULT NULL COMMENT 'If the command is Whietlisted, this is the reply that will be sent to non-whitelisted users trying to invoke it.',
  `Read_Only` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, the command will not attempt to reply, and therefore trigger any message buffering. Use for commands with no reply.',
  `Opt_Outable` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, users can opt-out from this command, and therefore stop being its target. WARNING! The target user must be the command function''s first argument!',
  `Blockable` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, users can block others from this command, and therefore stop being its target for given other user. WARNING! The target user must be the command function''s first argument!',
  `Ping` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT 'If true and Channel''s Ping is also true, the command will "ping" users who invoke the command by prepending the result with their name.',
  `Pipeable` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT 'If true, the command will be usable in the meta-command pipe.',
  `Owner_Override` tinyint(1) unsigned DEFAULT 0,
  `Archived` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT 'If true, the command is no longer invokable or searchable.',
  `Static_Data` mediumtext DEFAULT NULL COMMENT 'Persistent data stored as a Javascript object.',
  `Code` text NOT NULL COMMENT 'Javascript command code. Must be a function, ideally async function if async operations are expected. First argument is context, the rest is rest-arguments from the user, split by space.',
  `Examples` text DEFAULT NULL COMMENT 'Deprecated property, do not use.',
  `Dynamic_Description` text DEFAULT NULL COMMENT 'Javascript function that returns command''s description on website. Usually async function. First argument = command prefix (string).',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name` (`Name`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4;