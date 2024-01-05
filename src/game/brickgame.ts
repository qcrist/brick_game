import {RendererCtx, RendererRef, SpriteBounds} from "#root/src/renderer/renderer";
import {SDict} from "#root/src/util/helper_types";
import {produce} from "immer";

const REMOVE = "REMOVE";
type brick_inf = [fill: string, border: string];
type brick_type = keyof typeof brick_states;

const brick_states = {
    // WALL: ["#c2c2c2", "#000"],
    LEFT1: ["#99b6ff", "#000"],
    LEFT2: ["#b3ff99", "#000"],
    LEFT3: ["#ffa299", "#000"],
} satisfies SDict<brick_inf>;

type brick_transition = (keyof typeof brick_states) | typeof REMOVE;

const brick_transitions: { [K in brick_type]: brick_transition } = {
    // WALL: "WALL",
    LEFT1: REMOVE,
    LEFT2: "LEFT1",
    LEFT3: "LEFT2"
}

function brickColor(type: brick_type) {
    const [fill, border] = brick_states[type];
    return {fill, border};
}

type Brick = {
    id: string,
    bounds: SpriteBounds,
    sprite_id: RendererRef,
    type: brick_type
}

type PhysicsRect = {
    cx: number,
    cy: number,
    hw: number,
    hh: number
}

type Runnable = () => void;

type PhysicsObj = {
    pos: PhysicsRect,
    on_hit?: Runnable
}

type Vector2 = {
    x: number,
    y: number
}

type GameBall = {
    pos: PhysicsRect;
    vel: Vector2
}

function physicsFromBounds({x, y, w, h}: SpriteBounds): PhysicsRect {
    return {
        cx: x + w / 2,
        cy: y + h / 2,
        hw: w / 2,
        hh: h / 2
    }
}

function boundsFromPhysics({cx, cy, hw, hh}: PhysicsRect): SpriteBounds {
    return {
        x: cx - hw,
        y: cy - hh,
        w: hw * 2,
        h: hh * 2
    }
}

const RENDER_PHYSICS = false;
const BORDER_SIZE = 40;

const DEBUG_BORDER_COLOR = 'red';
const DEBUG_BRICK_COLOR = 'purple';

const BALL_SIZE = 25;

const MAX_STEP = 0.1;

const BRICK_WIDTH = 40;
const BRICK_HEIGHT = 30;

const PADDLE_WIDTH = 150;
const PADDLE_HEIGHT = 10;
const PADDLE_SPACING = 20;

const BALL_SPEED = 500;
const PADDLE_MAX_DX = BALL_SPEED / 2;


function boundsOverlapCheck(a: PhysicsRect, b: PhysicsRect) {
    const dx = Math.abs(a.cx - b.cx);
    const dy = Math.abs(a.cy - b.cy);
    const sw = a.hw + b.hw;
    const sh = a.hh + b.hh;
    return (dx < sw) && (dy < sh);
}

function boundsOverlap(a: PhysicsRect, b: PhysicsRect): Vector2 {
    const x0 = Math.max(a.cx - a.hw, b.cx - b.hw);
    const x1 = Math.min(a.cx + a.hw, b.cx + b.hw);
    const y0 = Math.max(a.cy - a.hh, b.cy - b.hh);
    const y1 = Math.min(a.cy + a.hh, b.cy + b.hh);
    return {
        // x: x0,
        // y: y0,
        // h: y1 - y0,
        // w: x1 - x0
        y: y1 - y0,
        x: x1 - x0
    }
}

function vectorScale({x, y}: Vector2, scale: number): Vector2 {
    return {
        x: x * scale,
        y: y * scale
    }
}

function vectorNorm({x, y}: Vector2, length: number): Vector2 {
    const m = Math.hypot(x, y);
    return {
        x: x * length / m,
        y: y * length / m
    }
}

function vectorAdd({x: x1, y: y1}: Vector2, {x: x2, y: y2}: Vector2): Vector2 {
    return {
        x: x1 + x2,
        y: y1 + y2
    }
}

type hit_result = {
    f: number,
    ef: number,
    flipX: boolean;
    flipY: boolean;
}

function hitCalc(next_pos: PhysicsRect, hitObj: PhysicsObj, step: Vector2): hit_result {
    const ol = boundsOverlap(next_pos, hitObj.pos);
    const asx = Math.abs(step.x);
    const asy = Math.abs(step.y);

    const oxf = ol.x / asx;
    const oyf = ol.y / asy;
    const minf = Math.min(oxf, oyf);
    if (minf > 1) {
        console.log("minf", minf);
        throw new Error("minf > 1");
    }
    const adjOl: Vector2 = {
        x: ol.x - minf * asx,
        y: ol.y - minf * asy,
    };
    const f = 1 - minf;
    const flipX = adjOl.x <= adjOl.y;
    const flipY = adjOl.x >= adjOl.y;
    //todo just array sort?
    const ef = (flipX == flipY) ? f + 0.0001 : f;
    return {
        f,
        ef,
        flipX, flipY
    }
}

export class BrickGameCtx {

    readonly #renderer: RendererCtx;
    #stop: boolean = false;
    #game_over = false;

    readonly #on_stop: (() => void)[] = [];
    readonly #bricks: SDict<Brick> = {};
    readonly #static_physics: SDict<PhysicsObj> = {};

    readonly #game_ball: GameBall;
    readonly #ball_sprite_id: RendererRef;

    readonly #paddle_sprite_id: RendererRef;
    readonly #paddle_physics: PhysicsObj;

    constructor(
        renderer: RendererCtx
    ) {
        this.#renderer = renderer;
        const w = 800;
        const h = 600;


        this.#renderer.setBounds(w, h);

        const border_size2 = 2 * BORDER_SIZE;
        this.#addStatic('border-top', {
            w: w + border_size2, h: BORDER_SIZE, x: -BORDER_SIZE, y: -BORDER_SIZE
        }, DEBUG_BORDER_COLOR)
        this.#addStatic('border-left', {
            h: h + border_size2, w: BORDER_SIZE, y: -BORDER_SIZE, x: -BORDER_SIZE
        }, DEBUG_BORDER_COLOR)
        this.#addStatic('border-right', {
            h: h + border_size2, w: BORDER_SIZE, y: -BORDER_SIZE, x: w
        }, DEBUG_BORDER_COLOR)
        this.#addStatic('border-bot', {
            w: w + border_size2, h: BORDER_SIZE, x: -BORDER_SIZE, y: h
        }, DEBUG_BORDER_COLOR, () => this.#ballHitBottom());

        let next_brick_id = 0;


        // const types = Object.keys(brick_transitions) as brick_type[];

        for (let x = 0; x < w; x += BRICK_WIDTH) {
            for (let y = 0; y < 10; y++) {
                if (Math.random() > 0.8) continue;
                const brick_id = "brick_" + (next_brick_id++);
                const bounds: SpriteBounds = {
                    x,
                    y: y * BRICK_HEIGHT,
                    z: 0,
                    w: BRICK_WIDTH,
                    h: BRICK_HEIGHT
                };
                const brick_type: brick_type = "LEFT1";///types[(x / BRICK_WIDTH + y) % types.length];
                this.#addBrick(brick_id, brick_type, bounds);
            }
        }

        this.#game_ball = {
            pos: {cx: 100, cy: 350, hw: BALL_SIZE / 2, hh: BALL_SIZE / 2},
            vel: {x: 100, y: 100},
        }

        this.#ball_sprite_id = renderer.createSprite({
            ...boundsFromPhysics(this.#game_ball.pos),
            type: "color",
            c: "white"
        })

        this.#paddle_physics = {
            pos: {
                cx: w / 2,
                cy: h - PADDLE_HEIGHT / 2 - PADDLE_SPACING,
                hh: PADDLE_HEIGHT / 2,
                hw: PADDLE_WIDTH / 2
            }
        }
        this.#paddle_sprite_id = renderer.createSprite({
            ...boundsFromPhysics(this.#paddle_physics.pos),
            type: "color",
            c: "white"
        })

        this.#startRenderLoop();
        this.#registerWindowListener("keydown", this.#onKeyDown);
        this.#registerWindowListener("mousemove", this.#onMouseMove);
    }

    #addStatic(id: string, bounds: SpriteBounds, color: string, on_hit?: Runnable) {
        if (RENDER_PHYSICS) {
            this.#renderer.createSprite({
                ...bounds,
                z: 10000,
                type: "2color",
                fill: "transparent",
                border: color
            });
        }
        this.#static_physics[id] = {
            pos: physicsFromBounds(bounds),
            on_hit
        };
    }

    #ballHitBottom() {
        this.#game_over = true;
        this.#renderer.updateSprite(this.#ball_sprite_id, obj => {
            if (obj.type !== "color") throw new Error("bad ball sprite type");
            obj.c = "red";
        })
    }

    #addBrick(brick_id: string, type: brick_type, bounds: SpriteBounds) {
        const sprite_id = this.#renderer.createSprite({
            ...bounds,
            type: "2color",
            ...brickColor(type)
        });
        this.#bricks[brick_id] = {
            id: brick_id,
            bounds,
            sprite_id,
            type: type
        };
        this.#addStatic(brick_id, bounds, DEBUG_BRICK_COLOR, () => {
            this.#transitionBrick(brick_id);
        });
    }

    #transitionBrick(brick_id: string) {
        const brick = this.#bricks[brick_id];
        const transition = brick_transitions[brick.type];
        if (transition === REMOVE) {
            this.#renderer.deleteSprite(brick.sprite_id);
            delete this.#bricks[brick_id];
            delete this.#static_physics[brick_id];
        } else {
            brick.type = transition;
            this.#renderer.updateSprite(brick.sprite_id, obj => {
                if (obj.type !== "2color") throw new Error();
                return {
                    ...obj,
                    ...brickColor(transition)
                }
            });
        }
    }

    #updateBallRender() {
        this.#renderer.updateSprite(this.#ball_sprite_id, obj => ({
            ...obj,
            ...boundsFromPhysics(this.#game_ball.pos)
        }))
    }

    #updatePaddleRender() {
        this.#renderer.updateSprite(this.#paddle_sprite_id, obj => ({
            ...obj,
            ...boundsFromPhysics(this.#paddle_physics.pos)
        }))
    }

    #registerWindowListener<T extends keyof WindowEventMap>(event: T, handler: (this: BrickGameCtx, ev: WindowEventMap[T]) => void) {
        const controller = new AbortController();
        window.addEventListener(event, e => handler.apply(this, [e]), {signal: controller.signal});
        this.#on_stop.push(() => controller.abort())
    }

    #awaitAnimationFrame() {
        return new Promise(cb => {
            requestAnimationFrame(cb);
        })
    }

    #startRenderLoop() {
        this.#renderLoop().catch(err => {
            console.warn("render error", err);
        });
    }

    #nextBallPos(step: Vector2) {
        return produce(this.#game_ball.pos, d => {
            d.cx += step.x;
            d.cy += step.y;
        });
    }

    #stepBall(dt: number, paddle_hit: boolean = false) {
        const step = vectorScale(this.#game_ball.vel, dt);
        const next_pos = this.#nextBallPos(step);

        if (!paddle_hit && boundsOverlapCheck(next_pos, this.#paddle_physics.pos)) {
            const ball_bottom = this.#game_ball.pos.cy + this.#game_ball.pos.hh;
            const pad_top = this.#paddle_physics.pos.cy - this.#paddle_physics.pos.hh;
            if (ball_bottom <= pad_top) {
                const {f} = hitCalc(next_pos, this.#paddle_physics, step);
                const pStep = vectorScale(step, f);
                this.#game_ball.pos = this.#nextBallPos(pStep);
                this.#game_ball.vel.y *= -1;
                const dx = (this.#game_ball.pos.cx - this.#paddle_physics.pos.cx) / this.#paddle_physics.pos.hw;
                const dxm = Math.sign(dx) * Math.pow(Math.abs(dx), 1.5);
                const dxm1 = 1 - dxm;
                const base = vectorNorm(this.#game_ball.vel, BALL_SPEED);
                const adj = {x: dxm * PADDLE_MAX_DX, y: -dxm1 * PADDLE_MAX_DX / 4};
                console.log(adj);
                this.#game_ball.vel = vectorNorm(vectorAdd(base, adj), BALL_SPEED);
                this.#stepBall(dt * (1 - f));
                return;
            }
        }


        const hit = Object.values(this.#static_physics)
            .filter(x => boundsOverlapCheck(x.pos, next_pos))

        if (hit.length == 0) {
            this.#game_ball.pos = next_pos;
        } else {
            const hits: [PhysicsObj, hit_result][] = hit.map(x => [x, hitCalc(next_pos, x, step)]);
            hits.sort(([, a], [, b]) => a.ef - b.ef);

            const [hitObj, {flipX, flipY, f}] = hits[0];

            if (flipY) this.#game_ball.vel.y *= -1;
            if (flipX) this.#game_ball.vel.x *= -1;

            const pStep = vectorScale(step, f);
            this.#game_ball.pos = this.#nextBallPos(pStep);
            if (hitObj.on_hit) hitObj.on_hit();
            this.#stepBall(dt * (1 - f));
        }
    }

    async #renderLoop() {
        let last_render = Date.now();
        while (!this.#stop && !this.#game_over) {
            await this.#awaitAnimationFrame();

            const now = Date.now();
            const dt = Math.min(MAX_STEP, (now - last_render) / 1000);

            this.#stepBall(dt);
            this.#updateBallRender();

            // angle += 0.01;
            // this.#renderer.updateSprite(this.#sprite_id, sprite => {
            //     sprite.x = 100 + Math.sin(angle) * 40;
            //     sprite.y = 100 + Math.cos(angle) * 40;
            // })

            last_render = now;
        }
    }

    #onKeyDown(e: KeyboardEvent) {
        console.log(e.key);
    }

    #onMouseMove(e: MouseEvent) {
        const root = this.#renderer.rootElement();
        if (!root) return;

        const {left} = root.getBoundingClientRect();

        this.#paddle_physics.pos.cx = e.clientX - left;
        this.#updatePaddleRender();
    }

    stop() {
        this.#stop = true;
        for (let stop of this.#on_stop) {
            stop();
        }
    }
}