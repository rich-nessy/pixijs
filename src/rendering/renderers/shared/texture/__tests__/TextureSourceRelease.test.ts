import { CanvasSource } from '../sources/CanvasSource';
import { ImageSource } from '../sources/ImageSource';
import { TextureSource } from '../sources/TextureSource';
import { DOMAdapter } from '~/environment';

/** A 1x1 ImageBitmap. Closing one sets its width and height to zero. */
async function createBitmap(): Promise<ImageBitmap>
{
    const canvas = DOMAdapter.get().createCanvas(1, 1) as HTMLCanvasElement;

    return await createImageBitmap(canvas);
}

describe('TextureSource resource release', () =>
{
    it('should close an ImageBitmap resource on destroy', async () =>
    {
        const bitmap = await createBitmap();
        const source = new ImageSource({ resource: bitmap });

        expect(bitmap.width).toBe(1);

        source.destroy();

        expect(bitmap.width).toBe(0);
        expect(bitmap.height).toBe(0);
    });

    it('should close an ImageBitmap resource held by a plain TextureSource', async () =>
    {
        const bitmap = await createBitmap();
        const source = new TextureSource({ resource: bitmap });

        source.destroy();

        expect(bitmap.width).toBe(0);
    });

    it('should NOT close an ImageBitmap resource on unload, so it can be re-uploaded', async () =>
    {
        const bitmap = await createBitmap();
        const source = new ImageSource({ resource: bitmap });

        source.unload();

        expect(bitmap.width).toBe(1);
        expect(source.resource).toBe(bitmap);

        source.destroy();
    });

    it('should blank an HTMLImageElement resource on destroy', () =>
    {
        const image = new Image(1, 1);

        // a real, tiny, decodable source so the browser has something to hold on to
        image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        const source = new ImageSource({ resource: image });

        source.destroy();

        expect(image.getAttribute('src')).toBeNull();
    });

    it('should collapse a canvas resource on destroy', () =>
    {
        const canvas = DOMAdapter.get().createCanvas(64, 32);
        const source = new CanvasSource({ resource: canvas });

        expect(canvas.width).toBe(64 * source.resolution);

        source.destroy();

        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);
    });

    it('should not throw when destroying a source twice', async () =>
    {
        const bitmap = await createBitmap();
        const source = new ImageSource({ resource: bitmap });

        source.destroy();

        expect(() => source.destroy()).not.toThrow();
    });

    it('should not throw when the resource type has nothing to release', () =>
    {
        const source = new TextureSource();

        expect(() => source.destroy()).not.toThrow();
    });
});
