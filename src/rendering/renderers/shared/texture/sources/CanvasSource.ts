import { DOMAdapter } from '../../../../../environment/adapter';
import { ExtensionType } from '../../../../../extensions/Extensions';
import { TextureSource } from './TextureSource';

import type { ICanvas } from '../../../../../environment/canvas/ICanvas';
import type { ExtensionMetadata } from '../../../../../extensions/Extensions';
import type { TextureSourceOptions } from './TextureSource';

/**
 * Options for creating a CanvasSource.
 * @category rendering
 * @advanced
 */
export interface CanvasSourceOptions extends TextureSourceOptions<ICanvas>
{
    /**
     * Should the canvas be resized to preserve its screen width and height regardless
     * of the resolution of the renderer, this is only supported for HTMLCanvasElement
     * and will be ignored if the canvas is an OffscreenCanvas.
     */
    autoDensity?: boolean;
    /** if true, this canvas will be set up to be transparent where possible */
    transparent?: boolean;
}

/**
 * A texture source that uses a canvas as its resource.
 * It automatically resizes the canvas based on the width, height, and resolution.
 * It also provides a 2D rendering context for drawing.
 * @category rendering
 * @advanced
 */
export class CanvasSource extends TextureSource<ICanvas>
{
    public static extension: ExtensionMetadata = ExtensionType.TextureSource;

    public uploadMethodId = 'image';
    public autoDensity: boolean;
    public transparent: boolean;

    private _context2D: CanvasRenderingContext2D;

    /** @internal */
    public _gpuContext: GPUCanvasContext;

    constructor(options: CanvasSourceOptions)
    {
        if (!options.resource)
        {
            options.resource = DOMAdapter.get().createCanvas();
        }

        if (!options.width)
        {
            options.width = options.resource.width;

            if (!options.autoDensity)
            {
                options.width /= options.resolution;
            }
        }

        if (!options.height)
        {
            options.height = options.resource.height;

            if (!options.autoDensity)
            {
                options.height /= options.resolution;
            }
        }

        super(options);

        this.autoDensity = options.autoDensity;

        this.resizeCanvas();

        this.transparent = !!options.transparent;
    }

    public resizeCanvas()
    {
        if (this.autoDensity && 'style' in this.resource)
        {
            this.resource.style.width = `${this.width}px`;
            this.resource.style.height = `${this.height}px`;
        }

        // only resize if wee need to, as this clears the canvas (even if values are set to the same)
        if (this.resource.width !== this.pixelWidth || this.resource.height !== this.pixelHeight)
        {
            this.resource.width = this.pixelWidth;
            this.resource.height = this.pixelHeight;
        }
    }

    public resize(width = this.width, height = this.height, resolution = this._resolution): boolean
    {
        const didResize = super.resize(width, height, resolution);

        if (didResize)
        {
            this.resizeCanvas();
        }

        return didResize;
    }

    public static test(resource: any): resource is ICanvas
    {
        return (globalThis.HTMLCanvasElement && resource instanceof HTMLCanvasElement)
        || (globalThis.OffscreenCanvas && resource instanceof OffscreenCanvas);
    }

    protected override _releaseResource(): void
    {
        super._releaseResource();

        // a canvas keeps its backing store - width * height * 4 bytes, and on some platforms a
        // GPU-side copy too - until it is resized away, so collapse it now that nothing can draw
        // to or upload from this source again
        const { resource } = this;

        this._context2D = null;
        this._gpuContext = null;

        try
        {
            resource.width = 0;
            resource.height = 0;
        }
        catch (_e)
        {
            // a read-only canvas (some ICanvas implementations) - nothing more we can do
        }
    }

    /**
     * Returns the 2D rendering context for the canvas.
     * Caches the context after creating it.
     * @returns The 2D rendering context of the canvas.
     */
    get context2D(): CanvasRenderingContext2D
    {
        return this._context2D || (this._context2D = this.resource.getContext('2d') as CanvasRenderingContext2D);
    }
}
