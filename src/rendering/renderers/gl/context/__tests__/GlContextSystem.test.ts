import { getWebGLRenderer, wait } from '@test-utils';

import type { WebGLRenderer } from '../../WebGLRenderer';

/**
 * Loses the context the way a browser does - straight through the extension, so
 * `forceContextLoss` never marks the loss as self-inflicted.
 * @param renderer - The renderer whose context to lose.
 */
function loseContextExternally(renderer: WebGLRenderer): void
{
    const { loseContext } = renderer.context.extensions;

    if (!loseContext)
    {
        throw new Error('WEBGL_lose_context is not available, cannot force a context loss');
    }

    loseContext.loseContext();
}

/**
 * Resolves when the canvas reports its context lost, or after `timeout` ms.
 *
 * `loseContext()` dispatches `webglcontextlost` asynchronously, so a test that acts on the loss
 * has to wait for it rather than assuming it landed.
 * @param renderer - The renderer to watch.
 * @param timeout - How long to wait before giving up.
 */
function contextLost(renderer: WebGLRenderer, timeout = 1000): Promise<boolean>
{
    return new Promise((resolve) =>
    {
        const timer = setTimeout(() => resolve(false), timeout);

        renderer.canvas.addEventListener('webglcontextlost', () =>
        {
            clearTimeout(timer);
            resolve(true);
        }, { once: true });
    });
}

/**
 * Resolves when the canvas reports its context restored, or after `timeout` ms.
 * @param renderer - The renderer to watch.
 * @param timeout - How long to wait before giving up.
 */
function contextRestored(renderer: WebGLRenderer, timeout = 1000): Promise<boolean>
{
    return new Promise((resolve) =>
    {
        const timer = setTimeout(() => resolve(false), timeout);

        renderer.canvas.addEventListener('webglcontextrestored', () =>
        {
            clearTimeout(timer);
            resolve(true);
        }, { once: true });
    });
}

describe('GlContextSystem context loss', () =>
{
    it('should emit the contextLost runner when the browser takes the context away', async () =>
    {
        const renderer = await getWebGLRenderer();
        const onContextLost = jest.fn();

        renderer.runners.contextLost.add({ contextLost: onContextLost });

        loseContextExternally(renderer);
        await expect(contextLost(renderer)).resolves.toBe(true);

        expect(onContextLost).toHaveBeenCalledTimes(1);
        // SystemRunner.emit always passes eight positional args, so check the first one
        expect(onContextLost.mock.calls[0][0]).toBe(renderer);

        await contextRestored(renderer);
        renderer.destroy();
    });

    it('should restore a context the browser took away', async () =>
    {
        const renderer = await getWebGLRenderer();
        const onContextChange = jest.fn();

        loseContextExternally(renderer);

        expect(renderer.context.isLost).toBe(true);

        renderer.runners.contextChange.add({ contextChange: onContextChange });

        await expect(contextRestored(renderer)).resolves.toBe(true);

        expect(renderer.context.isLost).toBe(false);
        expect(onContextChange).toHaveBeenCalled();

        renderer.destroy();
    });

    it('should leave the context lost when restoreContextOnLoss is off', async () =>
    {
        const renderer = await getWebGLRenderer({ restoreContextOnLoss: false });
        const onContextLost = jest.fn();

        renderer.runners.contextLost.add({ contextLost: onContextLost });

        loseContextExternally(renderer);
        await expect(contextLost(renderer)).resolves.toBe(true);

        // the app still gets told, it just has to recover for itself
        expect(onContextLost).toHaveBeenCalledTimes(1);

        await expect(contextRestored(renderer, 100)).resolves.toBe(false);

        expect(renderer.context.isLost).toBe(true);

        renderer.destroy();
    });

    it('should still restore a forced context loss when restoreContextOnLoss is off', async () =>
    {
        const renderer = await getWebGLRenderer({ restoreContextOnLoss: false });

        renderer.context.forceContextLoss();

        await expect(contextRestored(renderer)).resolves.toBe(true);

        expect(renderer.context.isLost).toBe(false);

        renderer.destroy();
    });

    it('should not restore twice after a forced loss', async () =>
    {
        const renderer = await getWebGLRenderer();
        const restoreSpy = jest.spyOn(renderer.context.extensions.loseContext, 'restoreContext');

        renderer.context.forceContextLoss();

        await contextRestored(renderer);
        // let any second, erroneously scheduled restore run
        await wait(20);

        expect(restoreSpy).toHaveBeenCalledTimes(1);

        restoreSpy.mockRestore();
        renderer.destroy();
    });
});
