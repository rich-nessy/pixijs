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
