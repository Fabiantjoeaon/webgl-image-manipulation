import canvasSketch from "canvas-sketch";
import createRegl from "regl";
import glslify from "glslify";
import mat4 from "gl-mat4";
import PlaneGeometry from "./PlaneGeometry";
import { math } from "canvas-sketch-util";

import { getParameterByName, replaceUrlParam } from "./browser";

import * as dat from "dat.gui";
const gui = new dat.GUI();

const settings = {
    // Make the loop animated
    animate: true,
    // Get a WebGL canvas rather than 2D
    context: "webgl",
    // Turn on MSAA
    attributes: { antialias: true }
};

const params = {
    shouldRotate: false
};

const updateUniforms = (val, key) => (params[key] = val);

gui.add(params, "shouldRotate")
    .name("Rotate Z")
    .onChange(val => updateUniforms(val, "shouldRotate"));

let currentTexture = getParameterByName("texture", window.location.href);
currentTexture = currentTexture ? currentTexture : "texture3.jpeg";
gui.add({ texture: currentTexture }, "texture", [
    "texture1.jpeg",
    "texture2.jpeg",
    "texture3.jpeg",
    "vid1.mp4",
    "vid2.mp4"
]).onChange(val => {
    window.location.href = replaceUrlParam(
        window.location.href,
        "texture",
        val
    );
});

function getRelativeMousePosition(event, target) {
    const rect = target.getBoundingClientRect();

    return {
        // Now returns 0 because of full sized canvas
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// assumes target or event.target is canvas
function getNoMarginCanvasRelativeMousePosition(event, target) {
    const pos = getRelativeMousePosition(event, target);

    pos.x = (pos.x * target.width) / target.clientWidth;
    pos.y = (pos.y * target.height) / target.clientHeight;

    return pos;
}

// TODO: Fix vertex mouse position
const isVideo = currentTexture.includes("vid");
const manifest = isVideo
    ? {
          video: {
              type: "video",
              src: `../${currentTexture}`,
              stream: true
          }
      }
    : {
          image: {
              type: "image",
              src: `../${currentTexture}`
          }
      };

require("resl")({
    manifest,
    onDone: data => {
        const texture = isVideo ? data.video : data.image;
        const sketch = async ({ gl, canvasHeight, canvasWidth }) => {
            const regl = createRegl({ gl });
            // const image = regl.texture(video);
            // const image = await load("./texture2.jpeg");

            const vid = regl.texture(texture);
            if (isVideo) {
                texture.autoplay = true;
                texture.loop = true;
                texture.muted = true;
                texture.play();
            }

            const { normals, vertices, uvs, indices } = new PlaneGeometry(
                900,
                500,
                200,
                200
            );

            const drawImage = regl({
                vert: glslify`
            precision highp float;
            #define M_PI 3.1415926535897932384626433832795
            uniform mat4 uProjection, uView, uRotate;
            uniform float uTime;
            uniform bool uShouldRotate;
            uniform vec2 uResolution;
            
            varying vec2 vUv;

            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec2 aUv;
            uniform vec2 uMousePosition;
            uniform vec2 uTextureResolution;

            // #pragma glslify: _cnoise4 = require(glsl-noise/classic/4d)

            // https://catlikecoding.com/unity/tutorials/flow/waves/
            vec3 gerstnerWave(vec4 wave, vec3 position, inout vec3 tangent, inout vec3 binormal) {
                float steepNess = wave.z;
                float waveLength = wave.w;

                // Wave number
                float k = 2. * M_PI / waveLength; 
                float c = sqrt(9.8 / k);
                float a = steepNess / k;
                vec2 normalizedDir = normalize(vec2(wave.x, wave.y));
                float f = k * (dot(normalizedDir, aPosition.xy) - c * uTime);           

                tangent += normalize(
                    vec3(
                        1. - steepNess * sin(f), 
                        steepNess * cos(f), 
                        0.
                    )
                );

                binormal += vec3(k * (aPosition.x - c * uTime));

                return vec3(
                    normalizedDir.x * (a * cos(f)),
                    a * sin(f),
                    normalizedDir.y * (a * cos(f))
                );
            }

            void main() {
                mat4 mv = uProjection * uView;
                vec3 scaledNormal = aNormal * 4.;
                
                // float r = _cnoise4(vec4(0.05 * aPosition + vec3(20.), vec3( 100. )));   
                vec2 invertedMouse = uMousePosition * -1.;

                vUv = aUv;

                vec2 st = aPosition.xy / uResolution;
                float dist = distance(invertedMouse, st);                
                
                vec3 displacement = aPosition;
                vec4 waveA = vec4(1., 1., .5, dist * 100.);
                vec4 waveB = vec4(0., 1., 0.95, dist * 20.);
                vec4 waveC = vec4(1., 0., 0.75, dist * 10.);

                vec3 normal = aNormal;
                vec3 tangent = vec3(1., 0., 0.);
                displacement += gerstnerWave(waveA, displacement, tangent, normal);
                displacement += gerstnerWave(waveB, displacement, tangent, normal);
                displacement += gerstnerWave(waveC, displacement, tangent, normal);

                if(uShouldRotate) {
                    mv = mv * uRotate;
                }
            
                gl_Position = mv * vec4(displacement, 1.);
            }
        `,
                frag: glslify`
            precision highp float;
            #define M_PI 3.1415926535897932384626433832795

            uniform sampler2D uTexture;
            uniform vec2 uResolution;
            uniform float uTime;
            uniform vec2 uMousePosition;
            uniform vec2 uTextureResolution;

            varying vec2 vUv;
            
            float map(float value, float min1, float max1, float min2, float max2) {
                 return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
            }
            
            void main() {
                float t = sin(uTime);
                vec2 st = gl_FragCoord.xy / uResolution;

                vec2 NDCMousePosition = vec2(
                    map(
                        uMousePosition.x,
                        -1.,
                        1.,
                        0.,
                        1.        
                    ),
                    map(
                        uMousePosition.y,
                        -1.,
                        1.,
                        1.,
                        0.        
                    )
                );

                vec2 uv = vUv;
                
                float distortion = sin(st.y * 100.) * t / 100.;

                vec4 texel = texture2D(uTexture, vUv);
                
                float dist = distance(NDCMousePosition, st);

                if(dist < .03) {
                    texel *= M_PI * cos(texel.x) * sin(uTime * 2.);
                }
                
                gl_FragColor = texel;
            }
        `,
                attributes: {
                    aPosition: vertices,
                    aNormal: normals,
                    aUv: uvs
                },
                uniforms: {
                    uProjection: ({ viewportWidth, viewportHeight }) => {
                        return mat4.perspective(
                            [],
                            Math.PI / 4,
                            viewportWidth / viewportHeight,
                            0.01,
                            1000
                        );
                    },
                    uView: ({ tick }) => {
                        const t = tick * 0.01;
                        return mat4.lookAt(
                            [],
                            // Vec3 eye
                            // [40 * Math.cos(tick * 0.5), 5 * Math.sin(tick), -700],
                            [80 * Math.cos(t), 15 * Math.sin(t), -700],
                            // [0, 0, -700],
                            // Vec3 center
                            [0, 0, 0],
                            // Vec3 up
                            [0, 1, 0]
                        );
                    },
                    uRotate: () => {
                        const rotationYMatrix = mat4.create();
                        mat4.rotateX(
                            rotationYMatrix,
                            rotationYMatrix,
                            math.degToRad(70)
                        );

                        return rotationYMatrix;
                    },
                    uTextureResolution: new Float32Array([
                        texture.width,
                        texture.height
                    ]),

                    uShouldRotate: (_context, props) => props.shouldRotate,
                    uTexture: (_context, props) => props.texture,

                    uResolution: new Float32Array([canvasWidth, canvasHeight]),
                    uTime: (_context, { time }) => time,
                    uMousePosition: (_context, { mouse }) => {
                        return new Float32Array([mouse.x, mouse.y]);
                    }
                },
                elements: indices,
                depth: {
                    enable: true
                }
            });

            window.addEventListener("mousemove", e => {
                const pos = getNoMarginCanvasRelativeMousePosition(
                    e,
                    gl.canvas
                );
                // Move from -1 to 1 range to 0 - 1
                // window.mouseX = math.mapRange(
                //     (pos.x / gl.canvas.width) * 2 - 1,
                //     -1,
                //     1,
                //     0,
                //     1
                // );
                // window.mouseY = math.mapRange(
                //     (pos.y / gl.canvas.height) * -2 + 1,
                //     -1,
                //     1,
                //     0,
                //     1
                // );
                window.mouseX = (pos.x / canvasWidth) * 2 - 1;
                window.mouseY = (pos.y / canvasHeight) * 2 - 1;
                // window.
            });

            // Return the renderer function
            return ({ time }) => {
                const { shouldRotate } = params;
                // Update regl sizes
                regl.poll();

                // Clear back buffer
                regl.clear({
                    color: [1, 1, 1, 1],
                    depth: 1
                });

                // Draw meshes to scene
                drawImage({
                    shouldRotate,
                    texture: isVideo
                        ? vid.subimage({
                              data: texture,
                              flipY: true,
                              wrapS: "mirror",
                              wrapT: "mirror"
                          })
                        : regl.texture({ data: texture, flipY: true }),
                    time,
                    mouse: {
                        x: window.mouseX || 0,
                        y: window.mouseY || 0
                    }
                });
            };
        };

        canvasSketch(sketch, settings);
    },
    onError: err => {
        console.error(err);
    }
});
