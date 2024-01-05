import React, {useEffect, useRef} from "react";
import {BrickGameCtx} from "#root/src/game/brickgame";
import {asRef, RendererCtx, RendererRef, Sprite} from "#root/src/renderer/renderer";
import {useConst} from "#root/src/util/react";
import {Immutable} from "immer";
import {createStore, StoreApi, useStore} from "zustand";
import {immer_setter} from "#root/src/util/immer";
import {useShallow} from "zustand/react/shallow";
import styled from "styled-components";

type bounds_t = { width: number, height: number };

type RenderState = Immutable<{
    sprites: { [key: RendererRef]: Sprite },
    images: { [key: RendererRef]: string },
    bounds: bounds_t
    createRenderer(): RendererCtx;
    listSprites(): RendererRef[];
}>;

type StoreType = StoreApi<RenderState>;
type SpriteRenderCache = { [key: string]: React.JSX.Element }


const WrapperDiv = styled.div`
  display: grid;
  height: 100%;
  grid-template-rows: 1fr auto 1fr;
  grid-template-columns: 1fr auto 1fr;
  background: black;
`;

const MainDiv = styled.div<{ $bounds: bounds_t }>`
  width: ${x => x.$bounds.width}px;
  height: ${x => x.$bounds.height}px;
  //border: 1px solid black;
  //box-sizing: border-box;
  position: relative;
  grid-column-start: 2;
  grid-row-start: 2;
  overflow: hidden;
  border: 3px solid gray;
  background: #111;
  cursor: none;
`

export function BrickGameReactRenderer() {
    const rootRef = useRef<HTMLDivElement>(null);

    const store = useConst(() =>
        createStore<RenderState>(((set, get) => {
            const immer_set = immer_setter(set);
            let next_id = 0;

            function nextRef() {
                return asRef((next_id++).toString());
            }

            return ({
                sprites: {},
                images: {},
                bounds: {width: 400, height: 400},
                next_id: 0,
                createRenderer(): RendererCtx {
                    return {
                        // updateSprite(id: RendererRef, updateF: Partial<SpriteBase>) {
                        //     immer_set(state => {
                        //         state.sprites[id] = {
                        //             ...state.sprites[id],
                        //             ...update
                        //         };
                        //     })
                        // },
                        updateSprite(id, updateFn) {
                            immer_set(state => {
                                const ret = updateFn(state.sprites[id]);
                                if (ret !== undefined) {
                                    state.sprites[id] = ret;
                                }
                            });
                        },
                        async createImage(img) {
                            const id = nextRef();
                            immer_set(state => {
                                state.images[id] = img;
                            })
                            return id;
                        },
                        createSprite(sprite) {
                            const id = nextRef();
                            immer_set(state => {
                                state.sprites[id] = sprite;
                            })
                            return id;
                        },
                        deleteSprite(id) {
                            const read = get().sprites[id];
                            immer_set(state => {
                                delete state.sprites[id];
                            })
                            return read;
                        },
                        setBounds(width, height) {
                            immer_set(state => {
                                state.bounds = {width, height};
                            })
                        },
                        rootElement() {
                            return rootRef.current;
                        }
                    }
                },
                listSprites(): RendererRef[] {
                    return Object.keys(get().sprites).map(x => asRef(x));
                }
            });
        })));
    const createRenderer = useStore(store, s => s.createRenderer);

    useEffect(() => {
        //TODO technically createRenderer COULD change...
        const ctx = new BrickGameCtx(createRenderer());

        return () => ctx.stop();

    }, []);

    const spriteRenderCache = useConst<SpriteRenderCache>(() => ({}));

    const sprites = useStore(store, useShallow(s => s.listSprites()));
    const bounds = useStore(store, s => s.bounds);

    const activeSprites = new Set(sprites);
    for (const key of Object.keys(spriteRenderCache)) {
        if (!activeSprites.has(key as RendererRef))
            delete spriteRenderCache[key];
    }

    for (const key of sprites) {
        if (!spriteRenderCache[key])
            spriteRenderCache[key] = <SpriteRender store={store} id={asRef(key)} key={key}/>
    }


    return <WrapperDiv>
        <MainDiv ref={rootRef} $bounds={bounds}>
            {sprites.map(id => spriteRenderCache[id])}
        </MainDiv>
    </WrapperDiv>
}

type SpriteRenderProps = { store: StoreType, id: RendererRef };

type SpriteDivProps = { $sprite: Sprite, $imgRef?: string }

const SpriteDiv = styled.div.attrs<SpriteDivProps>(({$sprite: sprite, $imgRef: i}) => {
    let color: string | undefined = undefined;
    let border: string | undefined = undefined;
    if (sprite.type === "color") {
        color = sprite.c;
    } else if (sprite.type == "2color") {
        color = sprite.fill;
        border = `1px solid ${sprite.border}`;
    }
    return ({
        style: {
            height: sprite.h,
            width: sprite.w,
            top: sprite.y,
            left: sprite.x,
            zIndex: sprite.z,
            backgroundColor: color,
            border,
            backgroundImage: sprite.type === "img" ? i : undefined
        } satisfies React.CSSProperties
    });
})`
  position: absolute;
  display: inline-block;
  box-sizing: border-box;
  //transition: top 30ms linear;
`;

function SpriteRender({store, id}: SpriteRenderProps) {
    const sprite = useStore(store, s => s.sprites[id]);
    const img = useStore(store, s => {
        if (sprite.type === "img")
            return s.images[sprite.i];
        return undefined;
    })

    return <SpriteDiv $sprite={sprite} $imgRef={img}/>
}