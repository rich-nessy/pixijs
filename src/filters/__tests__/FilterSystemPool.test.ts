import { AlphaFilter } from '../defaults/alpha/AlphaFilter';
import { NoiseFilter } from '../defaults/noise/NoiseFilter';
import { getWebGLRenderer } from '@test-utils';
import { Texture, TexturePool } from '~/rendering';
import { Container, Sprite } from '~/scene';

/** A container with a filter, holding a child that also has one, so the filter stack nests. */
function createNestedFilteredScene(): Container
{
    const outer = new Container();
    const inner = new Container();
    const sprite = new Sprite(Texture.WHITE);

    sprite.setSize(50, 50);

    outer.filters = [new AlphaFilter({ alpha: 0.5 })];
    inner.filters = [new NoiseFilter({ noise: 0.5 })];

    inner.addChild(sprite);
    outer.addChild(inner);

    return outer;
}

describe('FilterSystem pooled texture lifetime', () =>
{
    it('should render nested filters again after the texture pool is cleared', async () =>
    {
        const renderer = await getWebGLRenderer({ width: 100, height: 100 });
        const scene = createNestedFilteredScene();

        renderer.render(scene);

        // an application reclaiming GPU memory between screens destroys the pooled render
        // targets the filter stack was still pointing at
        TexturePool.clear(true);

        expect(() => renderer.render(scene)).not.toThrow();

        renderer.destroy();
    });

    it('should release the filtered container when the filter is popped', async () =>
    {
        const renderer = await getWebGLRenderer({ width: 100, height: 100 });
        const scene = createNestedFilteredScene();

        renderer.render(scene);

        const filterStack = renderer.filter['_filterStack'];

        expect(filterStack.length).toBeGreaterThan(0);

        // nothing reads container after pop, and holding it pins the whole scene graph
        for (const filterData of filterStack)
        {
            expect(filterData.container).toBeNull();
        }

        renderer.destroy();
    });
});

describe('FilterSystem shared bind group lifetime', () =>
{
    it('should empty the bind group texture slots once the filters are applied', async () =>
    {
        const renderer = await getWebGLRenderer({ width: 100, height: 100 });
        const scene = createNestedFilteredScene();

        renderer.render(scene);

        const bindGroup = renderer.filter['_globalFilterBindGroup'];

        // the bind group outlives the renderer, so anything still here outlives the scene
        expect(bindGroup.getResource(1)).toBeNull();
        expect(bindGroup.getResource(2)).toBeNull();
        expect(bindGroup.getResource(3)).toBeNull();

        renderer.destroy();
    });

    it('should not warn when the texture pool is cleared after a filter render', async () =>
    {
        const renderer = await getWebGLRenderer({ width: 100, height: 100 });
        const scene = createNestedFilteredScene();

        renderer.render(scene);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { /* quiet */ });

        // pooled textures build their own style, so clearing the pool destroys both the source
        // and the sampler the bind group was still holding
        TexturePool.clear(true);

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
        renderer.destroy();
    });

    it('should still render correctly through repeated filter passes', async () =>
    {
        const renderer = await getWebGLRenderer({ width: 100, height: 100 });
        const scene = createNestedFilteredScene();

        // slots are emptied after every pass, so each render has to repopulate them
        for (let i = 0; i < 3; i++)
        {
            expect(() => renderer.render(scene)).not.toThrow();
        }

        const pixels = renderer.extract.pixels(scene);

        // the sprite is white at 0.5 alpha with noise over it - not blank
        expect(pixels.pixels.some((channel) => channel !== 0)).toBe(true);

        renderer.destroy();
    });
});
