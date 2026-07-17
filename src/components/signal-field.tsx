'use client';

import { useEffect, useRef } from 'react';

type SignalFieldProps = {
  className?: string;
  label?: string;
};

type FieldState = {
  pointer: [number, number];
  targetPointer: [number, number];
  time: number;
  frame: number;
  lastFrame: number;
};

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_scroll;
  varying vec2 v_uv;

  #define PI 3.14159265359

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  mat2 rotate(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 uv = (v_uv - 0.5) * aspect;
    vec2 pointer = u_pointer * vec2(aspect.x, 1.0);
    float t = u_time * 0.16;

    float pointerDistance = length(uv - pointer * 0.35);
    float pointerField = exp(-pointerDistance * 2.4);
    vec2 warped = uv + vec2(
      sin(uv.y * 5.0 + t * 1.4) * 0.045,
      cos(uv.x * 4.0 - t) * 0.035
    );
    warped += normalize(uv - pointer * 0.35 + 0.001) * pointerField * 0.06;

    float grain = noise(warped * 8.0 + t * 0.5);
    float fine = noise(warped * 15.0 - t * 0.6);
    float cloud = fbm(warped * 2.5 + vec2(t * 0.7, -t * 0.35));

    float wave = sin(warped.x * 4.4 + sin(warped.y * 3.0 + t) * 1.4 + t * 1.9);
    float ribbon = 1.0 - smoothstep(0.02, 0.12, abs(warped.y * 1.18 - wave * 0.14 - 0.06 * sin(warped.x * 2.0 - t)));
    float contour = 1.0 - smoothstep(0.015, 0.03, abs(sin(warped.x * 5.0 + warped.y * 2.0 + cloud * 1.4 + t) * 0.42 - warped.y));
    float gridX = 1.0 - smoothstep(0.02, 0.035, abs(fract((warped.x + 1.6) * 3.0) - 0.5));
    float gridY = 1.0 - smoothstep(0.02, 0.035, abs(fract((warped.y + 1.0) * 3.0) - 0.5));
    float grid = max(gridX, gridY) * 0.12;

    vec3 charcoal = vec3(0.035, 0.047, 0.044);
    vec3 graphite = vec3(0.10, 0.13, 0.12);
    vec3 acid = vec3(0.78, 0.95, 0.18);
    vec3 coral = vec3(0.95, 0.29, 0.24);

    vec3 color = mix(charcoal, graphite, cloud * 0.38 + grain * 0.06);
    color += acid * ribbon * (0.45 + 0.55 * pointerField);
    color += coral * contour * 0.34;
    color += acid * grid;
    color += vec3(0.22, 0.27, 0.24) * fine * 0.045;

    float vignette = smoothstep(1.55, 0.25, length(uv));
    color *= 0.58 + vignette * 0.42;
    color += acid * pointerField * 0.07;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export default function SignalField({ className, label = 'Live signal field' }: SignalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<FieldState>({
    pointer: [0.0, 0.0],
    targetPointer: [0.0, 0.0],
    time: 0,
    frame: 0,
    lastFrame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      canvas.dataset.fallback = 'true';
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      canvas.dataset.fallback = 'true';
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
    const scrollLocation = gl.getUniformLocation(program, 'u_scroll');
    const state = stateRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * scale));
      canvas.height = Math.max(1, Math.floor(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      const delta = Math.min(now - (state.lastFrame || now), 50);
      state.lastFrame = now;
      state.time += reduceMotion ? 0 : delta * 0.06;
      state.pointer[0] += (state.targetPointer[0] - state.pointer[0]) * 0.07;
      state.pointer[1] += (state.targetPointer[1] - state.pointer[1]) * 0.07;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLocation, state.time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(pointerLocation, state.pointer[0], state.pointer[1]);
      gl.uniform1f(scrollLocation, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!reduceMotion) state.frame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      state.targetPointer[0] = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      state.targetPointer[1] = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const onPointerLeave = () => {
      state.targetPointer[0] = 0;
      state.targetPointer[1] = 0;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);
    window.addEventListener('resize', resize, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    resize();
    draw(0);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(state.frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className={`signal-field ${className || ''}`}>
      <canvas ref={canvasRef} aria-label={label} role="img" />
      <div className="signal-field__grain" aria-hidden="true" />
      <div className="signal-field__scanline" aria-hidden="true" />
    </div>
  );
}
