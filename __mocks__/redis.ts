import { EventEmitter } from 'events';
const RealRedis = jest.requireActual('redis');

class RedisMock extends EventEmitter {
  private data: Record<string, any> = {};

  public connect() {
    this.emit('ready');
  }

  public quit() {
    this.emit('end');
  }

  public async exists(key: string) {
    return Object.keys(this.data).includes(key);
  }

  public async get(key: string) {
    return this.data[key] ?? null;
  }

  public async set(key: string, value: any) {
    this.data[key] = value;
  }

  public async getDel(key: string) {
    if (!(await this.exists(key))) {
      return;
    }

    const value = this.data[key];
    delete this.data[key];

    return value;
  }

  public async keys(prefix: string) {
    const fixedPrefix = prefix.endsWith('*') ? prefix.slice(0, prefix.length - 1) : prefix;

    return Object.keys(this.data).filter((key) => key.startsWith(fixedPrefix));
  }

  public async del(keys: string[]) {
    for (const key of keys) {
      if (await this.exists(key)) {
        delete this.data[key];
      }
    }
  }
}

export const createClient = (..._args: any[]) => {
  return new RedisMock();
};

export const RedisClientOptions = RealRedis.RedisClientOptions;
export const RedisClientType = RealRedis.RedisClientType;
export const RedisScripts = RealRedis.RedisScripts;
