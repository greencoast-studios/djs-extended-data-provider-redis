import { createClient, RedisClientOptions, RedisClientType, RedisScripts } from 'redis';
import { Guild } from 'discord.js';
import { DataProvider, ClearableDataProvider, ExtendedClient } from '@greencoast/discord.js-extended';

/**
 * A {@link DataProvider} implemented with a Redis backend.
 */
export class RedisDataProvider extends DataProvider implements ClearableDataProvider {
  /**
   * The Redis client for this data provider.
   * @private
   * @type {RedisClientType<any, any, Redis.RedisScripts>>}
   * @memberof RedisDataProvider
   */
  private redis: RedisClientType<any, any, RedisScripts>;

  /**
   * @param client The client that this data provider will be used by.
   * @param options The options passed to the Redis client.
   */
  public constructor(client: ExtendedClient, options: RedisClientOptions<any, any>) {
    super(client);

    this.redis = createClient(options);
  }

  /**
   * Initialize this Redis data provider. This connects the data provider to the Redis
   * service. It also delegates the Redis client error handling to the client's error event handler.
   * @returns A promise that resolves this Redis data provider once it's ready.
   * @emits `client#dataProviderInit`
   */
  public override async init(): Promise<this> {
    await this.redis.connect();

    this.redis.on('error', (error) => this.client.emit('error', error));
    this.client.emit('dataProviderInit', this);

    return this;
  }

  /**
   * Gracefully destroy this Redis data provider. This closes the connection to the Redis
   * service after queued up operations have ended.
   * @emits `client#dataProviderDestroy`
   */
  public override async destroy(): Promise<void> {
    await this.redis.quit();
    this.client.emit('dataProviderDestroy', this);
  }

  /**
   * Resolve the key for the provided guild or for the global scope if not provided.
   * @param key The key to resolve.
   * @param guild The [guild](https://old.discordjs.dev/#/docs/discord.js/main/class/Guild) for which the key will be resolved.
   * @private
   * @returns The resolved key.
   */
  private resolveKey(key: string, guild?: Guild): string {
    return guild ? `${guild.id}:${key}` : `global:${key}`;
  }

  /**
   * Get a value for a given absolute key.
   * @param key The key of the data to be queried.
   * @private
   * @returns A promise that resolves the queried data.
   */
  private _get<T = any>(key: string): Promise<T | undefined>;
  /**
   * Get a value for a given absolute key.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @private
   * @returns A promise that resolves the queried data.
   */
  private _get<T = any>(key: string, defaultValue: T): Promise<T>;
  /**
   * Get a value for a given absolute key.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @private
   * @returns A promise that resolves the queried data.
   */
  private async _get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const exists = await this.redis.exists(key);
    if (!exists) {
      return defaultValue;
    }

    return JSON.parse((await this.redis.get(key))!) as T | undefined;
  }

  /**
   * Get a value for a key in a guild.
   * @param guild The [guild](https://old.discordjs.dev/#/docs/discord.js/main/class/Guild) for which the data will be queried.
   * @param key The key of the data to be queried.
   * @returns A promise that resolves the queried data.
   */
  public override get<T = any>(guild: Guild, key: string): Promise<T | undefined>;
  /**
   * Get a value for a key in a guild.
   * @param guild The [guild](https://old.discordjs.dev/#/docs/discord.js/main/class/Guild) for which the data will be queried.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @returns A promise that resolves the queried data.
   */
  public override get<T = any>(guild: Guild, key: string, defaultValue: T): Promise<T>;
  /**
   * Get a value for a key in a guild.
   * @param guild The [guild](https://old.discordjs.dev/#/docs/discord.js/main/class/Guild) for which the data will be queried.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @returns A promise that resolves the queried data.
   */
  public override get<T = any>(guild: Guild, key: string, defaultValue?: T): Promise<T | undefined> {
    return defaultValue ?
      this._get<T>(this.resolveKey(key, guild), defaultValue) :
      this._get<T>(this.resolveKey(key, guild));
  }

  /**
   * Get a value for a key in a global scope.
   * @param key The key of the data to be queried.
   * @returns A promise that resolves the queried data.
   */
  public override getGlobal<T = any>(key: string): Promise<T | undefined>;
  /**
   * Get a value for a key in a global scope.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @returns A promise that resolves the queried data.
   */
  public override getGlobal<T = any>(key: string, defaultValue: T): Promise<T>;
  /**
   * Get a value for a key in a global scope.
   * @param key The key of the data to be queried.
   * @param defaultValue The default value in case there is no entry found.
   * @returns A promise that resolves the queried data.
   */
  public override getGlobal<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    return defaultValue ?
      this._get<T>(this.resolveKey(key), defaultValue) :
      this._get<T>(this.resolveKey(key));
  }

  /**
   * Set a value for an absolute key.
   * @param key The key of the data to be set.
   * @param value The value to set.
   * @private
   * @returns A promise that resolves once the data is saved.
   */
  private async _set<T = any>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      throw new TypeError('Stored value cannot be undefined, consider using null.');
    }
    await this.redis.set(key, JSON.stringify(value));
  }

  /**
   * Set a value for a key in a guild.
   * @param guild The [guild](https://discord.js.org/#/docs/discord.js/stable/class/Guild) for which the data will be set.
   * @param key The key of the data to be set.
   * @param value The value to set.
   * @returns A promise that resolves once the data is saved.
   */
  public override set<T = any>(guild: Guild, key: string, value: T): Promise<void> {
    return this._set<T>(this.resolveKey(key, guild), value);
  }

  /**
   * Set a value for a key in a global scope.
   * @param key The key of the data to be set.
   * @param value The value to set.
   * @returns A promise that resolves once the data is saved.
   */
  public override async setGlobal<T = any>(key: string, value: T): Promise<void> {
    return this._set<T>(this.resolveKey(key), value);
  }

  /**
   * Delete a value stored for a given absolute key.
   * @param key The key of the data to be set.
   * @private
   * @returns A promise that resolves once the data has been deleted.
   */
  private async _delete<T = any>(key: string): Promise<T | undefined> {
    const exists = await this.redis.exists(key);
    if (!exists) {
      return undefined;
    }

    return JSON.parse((await this.redis.getDel(key))!);
  }

  /**
   * Delete a key-value pair in a guild.
   * @param guild The [guild](https://discord.js.org/#/docs/discord.js/stable/class/Guild) for which the key-value pair will be deleted.
   * @param key The key to delete.
   * @returns A promise that resolves the data that has been deleted.
   */
  public override delete<T = any>(guild: Guild, key: string): Promise<T | undefined> {
    return this._delete<T>(this.resolveKey(key, guild));
  }

  /**
   * Delete a key-value pair in a global scope.
   * @param key The key to delete.
   * @returns A promise that resolves the data that has been deleted.
   */
  public override deleteGlobal<T = any>(key: string): Promise<T | undefined> {
    return this._delete<T>(this.resolveKey(key));
  }

  /**
   * Clear all data that start with the given pattern.
   * @param startsWith The pattern to look for the keys to delete.
   * @private
   * @returns A promise that resolves once all data has been deleted.
   */
  private async _clear(startsWith: string): Promise<void> {
    const keys = await this.redis.keys(`${startsWith}*`);
    if (!keys || keys.length < 1) {
      return;
    }

    await this.redis.del(keys);
  }

  /**
   * Clear all data in a guild.
   * @param guild The [guild](https://discord.js.org/#/docs/discord.js/stable/class/Guild) to clear the data from.
   * @returns A promise that resolves once all data has been deleted.
   * @emits `client#dataProviderClear`
   */
  public async clear(guild: Guild): Promise<void> {
    const { id } = guild;
    await this._clear(`${id}:`);

    this.client.emit('dataProviderClear', guild);
  }

  /**
   * Clear all data in a global scope.
   * @returns A promise that resolves once all data has been deleted.
   * @emits `client#dataProviderClear`
   */
  public async clearGlobal(): Promise<void> {
    await this._clear('global:');

    this.client.emit('dataProviderClear', null);
  }
}
