<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'

const props = defineProps<{ method: any; index: number; progress?: { visited: boolean; bestScore: number | null; attempts: number } }>()
const emit = defineEmits<{ open: []; quiz: [] }>()
const percent = computed(() => props.progress?.bestScore ?? (props.progress?.visited ? 15 : 0))
const stageCount = computed(() => props.method.stages.length)
</script>

<template>
  <article class="method-card" :style="{ '--card-accent': method.accent }">
    <button class="card-visual" :class="`card-visual--${index % 3}`" type="button" :aria-label="`Вивчити ${method.title}`" @click="emit('open')">
      <div class="visual-grid"></div><div class="visual-ring visual-ring--one"></div><div class="visual-ring visual-ring--two"></div><div class="visual-ring visual-ring--three"></div>
      <div class="visual-core"><span>{{ String(index + 1).padStart(2, '0') }}</span><UiIcon name="sparkle" :size="26" /></div>
      <div class="visual-nodes"><i v-for="stage in Math.min(stageCount, 9)" :key="stage" :style="{ '--i': stage - 1, '--n': Math.min(stageCount, 9) }"></i></div>
      <span class="visual-label">{{ stageCount }} {{ stageCount === 5 ? 'рівнів' : stageCount === 6 ? 'рівнів' : 'етапів' }}</span>
      <span class="visual-corner"><UiIcon name="arrow" :size="16" /></span>
    </button>
    <div class="card-body"><div class="card-tags"><span class="category-tag"><span></span>{{ method.category }}</span><span class="difficulty-tag">{{ method.difficulty }}</span></div><h3>{{ method.title }}</h3><p class="card-author">{{ method.author }}</p><p class="card-summary">{{ method.summary }}</p><div class="card-divider"></div><div class="card-progress-line"><span>Ваш прогрес</span><strong>{{ percent }}%</strong></div><div class="card-progress-track"><span :style="{ width: `${percent}%` }"></span></div><div class="card-actions"><button class="card-open" type="button" @click="emit('open')">Вивчити методику <UiIcon name="arrow" :size="17" /></button><button v-if="progress?.visited" class="card-quiz" type="button" :aria-label="`Пройти тест: ${method.title}`" title="Пройти тест" @click="emit('quiz')"><UiIcon name="play" :size="16" /></button></div></div>
  </article>
</template>

<style scoped>
.method-card{min-width:0;border:1px solid var(--line);border-radius:19px;background:linear-gradient(165deg,rgba(24,30,54,.86),rgba(14,20,37,.96));overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s;box-shadow:0 12px 36px rgba(0,0,0,.12)}
.method-card:hover{transform:translateY(-5px);border-color:color-mix(in srgb,var(--card-accent) 40%,var(--line));box-shadow:0 24px 54px rgba(0,0,0,.22)}
.card-visual{position:relative;width:100%;height:164px;overflow:hidden;border:0;display:block;cursor:pointer;text-align:left;color:var(--card-accent);background:radial-gradient(circle at 50% 110%,color-mix(in srgb,var(--card-accent) 20%,transparent),transparent 52%),linear-gradient(135deg,#151b34,#11172c)}
.card-visual--1{background:radial-gradient(circle at 70% 125%,color-mix(in srgb,var(--card-accent) 20%,transparent),transparent 54%),linear-gradient(135deg,#151b34,#11172c)}
.card-visual--2{background:radial-gradient(circle at 30% 112%,color-mix(in srgb,var(--card-accent) 18%,transparent),transparent 54%),linear-gradient(135deg,#151b34,#11172c)}
.visual-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:26px 26px;mask-image:linear-gradient(to bottom,black,transparent)}
.visual-ring{position:absolute;border:1px solid color-mix(in srgb,var(--card-accent) 37%,transparent);border-radius:50%;left:50%;top:60%;transform:translate(-50%,-50%)}.visual-ring--one{width:72px;height:72px;background:color-mix(in srgb,var(--card-accent) 12%,transparent);box-shadow:0 0 36px color-mix(in srgb,var(--card-accent) 18%,transparent)}.visual-ring--two{width:150px;height:150px;border-style:dashed;opacity:.56}.visual-ring--three{width:235px;height:235px;opacity:.28}
.visual-core{position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);width:73px;height:73px;border-radius:50%;display:grid;place-items:center}.visual-core span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;letter-spacing:.18em;color:#fff7}.visual-core svg{filter:drop-shadow(0 0 14px currentColor)}
.visual-nodes{position:absolute;left:50%;top:60%;width:150px;height:150px;transform:translate(-50%,-50%)}.visual-nodes i{position:absolute;left:calc(50% + 70px * cos((var(--i) / var(--n) * 360deg) - 90deg));top:calc(50% + 70px * sin((var(--i) / var(--n) * 360deg) - 90deg));width:7px;height:7px;border:1px solid var(--card-accent);background:#12182c;border-radius:50%;box-shadow:0 0 10px var(--card-accent)}
.visual-label{position:absolute;bottom:15px;left:18px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#e5e8f1a8}.visual-corner{position:absolute;right:15px;top:15px;width:29px;height:29px;display:grid;place-items:center;color:#e9edfa;background:#ffffff12;border:1px solid #ffffff22;border-radius:8px;transform:rotate(-45deg)}
.card-body{padding:21px 22px 18px}.card-tags{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}.category-tag,.difficulty-tag{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.category-tag{color:var(--card-accent);display:flex;gap:7px;align-items:center}.category-tag span{width:5px;height:5px;border-radius:50%;background:currentColor}.difficulty-tag{color:#9da7bc;background:#ffffff0a;border:1px solid #ffffff12;border-radius:5px;padding:5px 7px;white-space:nowrap}.card-body h3{font-size:20px;line-height:1.25;letter-spacing:-.035em;min-height:50px;margin:0;color:var(--text)}.card-author{font-size:12px;color:#a4abc0;margin:7px 0 13px}.card-summary{font-size:13px;line-height:1.6;color:var(--muted);margin:0;min-height:63px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.card-divider{height:1px;background:var(--line);margin:19px 0 16px}.card-progress-line{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:9px}.card-progress-line strong{font-size:12px;color:var(--card-accent)}.card-progress-track{height:4px;border-radius:8px;background:#ffffff12;overflow:hidden}.card-progress-track span{display:block;height:100%;border-radius:8px;background:var(--card-accent);transition:width .4s}.card-actions{display:flex;gap:8px;margin-top:19px}.card-open{border:1px solid color-mix(in srgb,var(--card-accent) 28%,transparent);background:color-mix(in srgb,var(--card-accent) 12%,transparent);color:var(--card-accent);font:inherit;font-size:12px;font-weight:800;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:9px;padding:11px 14px;border-radius:9px;flex:1;transition:background .2s}.card-open:hover{background:color-mix(in srgb,var(--card-accent) 20%,transparent)}.card-quiz{width:40px;border-radius:9px;border:1px solid var(--line);color:var(--text);background:#ffffff0b;display:grid;place-items:center;cursor:pointer}.card-quiz:hover{background:#ffffff1c}
@media(max-width:700px){.card-body h3{min-height:0}.card-summary{min-height:0}}
</style>
