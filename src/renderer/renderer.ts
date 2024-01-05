import {Brand} from "#root/src/util/brand";

type SpriteTypeTag<T extends string> = { type: T };

type ImgSprite = {
    i: RendererRef
} & SpriteBounds & SpriteTypeTag<"img">;

type ColorSprite = {
    c: string,
} & SpriteBounds & SpriteTypeTag<"color">

type TwoColorSprite = {
    fill: string,
    border: string,
} & SpriteBounds & SpriteTypeTag<"2color">

export type SpriteBounds = {
    x: number,
    y: number,
    z?: number,
    w: number,
    h: number,
}

export type Sprite = ImgSprite | ColorSprite | TwoColorSprite;

export type RendererRef = Brand<string, "render-ref">;

export function asRef(value: string) {
    return value as RendererRef;
}

export interface RendererCtx {
    createSprite(sprite: Sprite): RendererRef;

    updateSprite(id: RendererRef, updateFn: (sprite: Sprite) => (Sprite | void)): void;

    deleteSprite(id: RendererRef): Sprite;

    createImage(img: string): Promise<RendererRef>;

    setBounds(width: number, height: number): void;

    rootElement(): HTMLElement | null;
}