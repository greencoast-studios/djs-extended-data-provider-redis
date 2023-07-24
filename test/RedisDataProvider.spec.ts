import { RedisDataProvider } from '../src';
import { Guild } from 'discord.js';
import { ExtendedClient, ExtendedClientEvents } from '@greencoast/discord.js-extended';

jest.mock('redis');

const client = new ExtendedClient({ debug: true, intents: [] });
const clientEventMocks: Partial<Record<keyof ExtendedClientEvents, (...args: any[]) => void>> = {
  dataProviderInit: jest.fn(),
  dataProviderDestroy: jest.fn(),
  dataProviderClear: jest.fn(),
  error: jest.fn()
};

Object.entries(clientEventMocks).forEach(([event, fn]) => client.on(event, fn));

describe('LevelDataProvider', () => {
  let provider: RedisDataProvider;

  beforeEach(() => {
    provider = new RedisDataProvider(client, {
      url: ''
    });
  });

  describe('init()', () => {
    const readySpy = jest.fn();

    beforeEach(() => {
      provider['redis'].on('ready', readySpy);
    });

    it('should resolve the provider object.', async () => {
      const result = await provider.init();
      expect(result).toBe(provider);
    });

    it('should ready up the db.', async () => {
      await provider.init();
      expect(readySpy).toHaveBeenCalled();
    });

    it('should delegate Redis client errors to client error handler.', async () => {
      await provider.init();
      provider['redis'].emit('error');
      expect(clientEventMocks.error).toHaveBeenCalled();
    });

    it('should emit a dataProviderInit event with the provider.', async () => {
      await provider.init();
      expect(clientEventMocks.dataProviderInit).toHaveBeenCalledWith(provider);
    });
  });

  describe('destroy()', () => {
    const endSpy = jest.fn();

    beforeEach(() => {
      provider['redis'].on('end', endSpy);
    });

    beforeEach(async () => {
      provider['redis'].on('ready', endSpy);
      await provider.init();
    });

    it('should close the db.', async () => {
      await provider.destroy();
      expect(endSpy).toHaveBeenCalled();
    });

    it('should emit a dataProviderDestroy event with the provider.', async () => {
      await provider.destroy();
      expect(clientEventMocks.dataProviderDestroy).toHaveBeenCalledWith(provider);
    });
  });

  describe('Data methods:', () => {
    const guild = { id: '123' } as unknown as Guild;

    const data = {
      key1: 'value1',
      key2: { val: 'value2' },
      key3: [1, 2, 3],
      key4: false,
      key5: null
    };

    beforeEach(async () => {
      await provider.init();
    });

    describe('get()', () => {
      beforeEach(async () => {
        for (const [key, value] of Object.entries(data)) {
          await provider.set(guild, key, value);
        }
      });

      it('should resolve the value stored.', async () => {
        for (const [key, value] of Object.entries(data)) {
          expect(await provider.get(guild, key)).toStrictEqual(value);
        }
      });

      it('should resolve with the default value if the key was not found.', async () => {
        const defaultValue = 'default';
        expect(await provider.get(guild, 'unknown', defaultValue)).toBe(defaultValue);
      });

      it('should resolve undefined if the key was not found and no default value is given.', async () => {
        expect(await provider.get(guild, 'unknown')).toBeUndefined();
      });
    });

    describe('getGlobal()', () => {
      const [key, value] = ['globalKey', 'globalValue'];

      beforeEach(async () => {
        await provider.setGlobal(key, value);
      });

      it('should resolve the value stored.', async () => {
        expect(await provider.getGlobal(key)).toBe(value);
      });

      it('should resolve with the default value if the key was not found.', async () => {
        const defaultValue = 'default';
        expect(await provider.getGlobal('unknown', defaultValue)).toBe(defaultValue);
      });

      it('should resolve undefined if the key was not found and no default value is given.', async () => {
        expect(await provider.getGlobal('unknown')).toBeUndefined();
      });
    });

    describe('set()', () => {
      const [key, value] = ['myKey', 'myValue'];

      it('should set new data.', async () => {
        await provider.set(guild, key, value);
        expect(await provider.get(guild, key)).toBe(value);
      });

      it('should replace old data.', async () => {
        const newValue = 'myOtherValue';

        await provider.set(guild, key, value);
        await provider.set(guild, key, newValue);

        expect(await provider.get(guild, key)).toBe(newValue);
      });

      it('should reject a TypeError if data provided is undefined.', async () => {
        await expect(provider.set(guild, key, undefined)).rejects.toBeInstanceOf(TypeError);
      });
    });

    describe('setGlobal()', () => {
      const [key, value] = ['myKey', 'myValue'];

      it('should set new data.', async () => {
        await provider.setGlobal(key, value);
        expect(await provider.getGlobal(key)).toBe(value);
      });

      it('should replace old data.', async () => {
        const newValue = 'myOtherValue';

        await provider.setGlobal(key, value);
        await provider.setGlobal(key, newValue);

        expect(await provider.getGlobal(key)).toBe(newValue);
      });

      it('should reject a TypeError if data provided is undefined.', async () => {
        await expect(provider.setGlobal(key, undefined)).rejects.toBeInstanceOf(TypeError);
      });
    });

    describe('delete()', () => {
      const [key, value] = ['myKey', 'myValue'];

      beforeEach(async () => {
        await provider.set(guild, key, value);
      });

      it('should delete existing data.', async () => {
        await provider.delete(guild, key);
        expect(await provider.get(guild, key)).toBeUndefined();
      });

      it('should resolve the deleted data.', async () => {
        expect(await provider.delete(guild, key)).toBe(value);
      });

      it('should resolve undefined if the key is not found.', async () => {
        expect(await provider.delete(guild, 'unknown')).toBeUndefined();
      });
    });

    describe('deleteGlobal()', () => {
      const [key, value] = ['myKey', 'myValue'];

      beforeEach(async () => {
        await provider.setGlobal(key, value);
      });

      it('should delete existing data.', async () => {
        await provider.deleteGlobal(key);
        expect(await provider.getGlobal(key)).toBeUndefined();
      });

      it('should resolve the deleted data.', async () => {
        expect(await provider.deleteGlobal(key)).toBe(value);
      });

      it('should resolve undefined if the key is not found.', async () => {
        expect(await provider.deleteGlobal('unknown')).toBeUndefined();
      });
    });

    describe('clear()', () => {
      const [globalKey, globalValue] = ['myKey', 'myValue'];

      beforeEach(async () => {
        for (const [key, value] of Object.entries(data)) {
          await provider.set(guild, key, value);
        }
        await provider.setGlobal(globalKey, globalValue);
      });

      it('should delete all entries.', async () => {
        await provider.clear(guild);

        for (const key of Object.keys(data)) {
          expect(await provider.get(guild, key)).toBeUndefined();
        }
      });

      it('should not modify the rest of the data.', async () => {
        await provider.clear(guild);
        expect(await provider.getGlobal(globalKey)).toBe(globalValue);
      });

      it('should emit a dataProviderClear event with the cleared guild.', async () => {
        await provider.clear(guild);
        expect(clientEventMocks.dataProviderClear).toHaveBeenCalledWith(guild);
      });
    });

    describe('clearGlobal()', () => {
      const globalData = {
        key1: 'value1',
        key2: 123,
        key3: true
      };

      beforeEach(async () => {
        for (const [key, value] of Object.entries(data)) {
          await provider.set(guild, key, value);
        }
        for (const [key, value] of Object.entries(globalData)) {
          await provider.setGlobal(key, value);
        }
      });

      it('should delete all entries.', async () => {
        await provider.clearGlobal();

        for (const key of Object.keys(globalData)) {
          expect(await provider.getGlobal(key)).toBeUndefined();
        }
      });

      it('should not modify the rest of the data.', async () => {
        await provider.clearGlobal();

        for (const [key, value] of Object.entries(data)) {
          expect(await provider.get(guild, key)).toStrictEqual(value);
        }
      });

      it('should emit a dataProviderClear event with null.', async () => {
        await provider.clearGlobal();
        expect(clientEventMocks.dataProviderClear).toHaveBeenCalledWith(null);
      });
    });
  });
});
