import { saveMemory } from '../memory/index.js';
import { markCompleted, markSkipped } from './onboardingStore.js';

const NEED_OPTIONS = ['生活伙伴', '开发伙伴', '学习伙伴', '思考伙伴', '创作伙伴', '情绪伙伴'];

const INTERACTION_OPTIONS = [
  {
    label: '直言不讳',
    description: '我会站在你的立场去分析问题，并直接告诉你我的理解，但仍然需要你的理性思维去做出属于你自己的决定。',
  },
  {
    label: '专业务实',
    description: '遇事先思考、探索、询问和理解更多实际因素变量，在整合到足够背景信息后直接给出结论和分析。',
  },
  {
    label: '知心损友',
    description: '犀利毒舌但会偶尔关心你。',
  },
  {
    label: '理解至上',
    description: '我会先自己设计几个问题，一步步通过我的方式来问你，来辅助你想清楚问题。',
  },
  {
    label: '稳定可靠',
    description: '我不会有任何情绪化倾向来处理你的任务，不夸赞、不追问，始终站在你的立场来处理我能做到的一切事情。',
  },
  {
    label: '安静寡言',
    description: '你可以向我诉说我能共情的一切事情，我不会批评和评判，只想和你慢慢相处，即便一开始我不会热情。',
  },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createInitialMemory({ layer, content }) {
  const now = Date.now();

  return {
    layer,
    content,
    summary: '',
    weight: 90,
    initialWeight: 90,
    isInitial: true,
    isUserRestored: false,
    protectedUntil: Infinity,
    createdAt: now,
    updatedAt: now,
    lastReferencedAt: now,
    source: 'init',
  };
}

async function saveOnboardingMemories({ userName, needs, interactionPreferences }) {
  await saveMemory(createInitialMemory({
    layer: 'identity',
    content: `用户希望被称为「${userName}」`,
  }));

  await saveMemory(createInitialMemory({
    layer: 'identity',
    content: `用户需要的是：${needs.join('、')}`,
  }));

  await Promise.all(interactionPreferences.map((option) => saveMemory(createInitialMemory({
    layer: 'habit',
    content: `交互偏好：${option.label}——${option.description}`,
  }))));
}

function buildProgress(step) {
  return `<div class="onboarding-progress" aria-label="引导进度">
    ${[0, 1, 2].map((index) => `<span class="onboarding-progress__dot${index === step ? ' active' : ''}"></span>`).join('')}
  </div>`;
}

function renderStepOne(state) {
  return `
    <h2 class="onboarding-title">你希望我叫你什么？</h2>
    <p class="onboarding-subtitle">这将是我对你的称呼</p>
    <input class="onboarding-input" type="text" value="${escapeHtml(state.userName)}" placeholder="输入你的名字或昵称" autocomplete="name" />
    <button class="onboarding-btn" type="button" disabled>下一步</button>
    ${buildProgress(0)}
  `;
}

function renderNeedOption(option, selectedNeeds) {
  const selected = selectedNeeds.includes(option);
  return `<button class="onboarding-option${selected ? ' selected' : ''}" type="button" data-need="${option}">
    <span class="onboarding-option__label">${option}</span>
  </button>`;
}

function renderStepTwo(state) {
  return `
    <h2 class="onboarding-title">你需要的是什么？</h2>
    <p class="onboarding-subtitle">可以多选，我会尽力成为你需要的那种伙伴</p>
    <div class="onboarding-options">
      ${NEED_OPTIONS.map((option) => renderNeedOption(option, state.needs)).join('')}
    </div>
    <button class="onboarding-btn" type="button" ${state.needs.length ? '' : 'disabled'}>下一步</button>
    ${buildProgress(1)}
  `;
}

function renderInteractionOption(option, state) {
  const selected = state.interactionPreferences.some((item) => item.label === option.label);
  const expanded = state.expandedInteraction === option.label;

  return `<button class="onboarding-option${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}" type="button" data-interaction="${option.label}">
    <span class="onboarding-option__label">${option.label}</span>
    <span class="onboarding-option__desc">${option.description}</span>
    <span class="onboarding-option__confirm" data-confirm-interaction="${option.label}">✓ 选择</span>
  </button>`;
}

function renderStepThree(state) {
  return `
    <h2 class="onboarding-title">你喜欢我怎么和你交互？</h2>
    <p class="onboarding-subtitle">可以多选，点击查看详细说明</p>
    <div class="onboarding-options">
      ${INTERACTION_OPTIONS.map((option) => renderInteractionOption(option, state)).join('')}
    </div>
    <button class="onboarding-btn" type="button" ${state.interactionPreferences.length ? '' : 'disabled'}>确认</button>
    ${buildProgress(2)}
  `;
}

function renderCard(card, state) {
  const renderers = [renderStepOne, renderStepTwo, renderStepThree];
  card.innerHTML = renderers[state.step](state);
}

function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function toggleInteractionPreference(preferences, option) {
  return preferences.some((item) => item.label === option.label)
    ? preferences.filter((item) => item.label !== option.label)
    : [...preferences, option];
}

export function mountOnboarding(container) {
  return new Promise((resolve) => {
    const state = {
      step: 0,
      userName: '',
      needs: [],
      interactionPreferences: [],
      expandedInteraction: null,
    };
    const overlay = document.createElement('section');
    const card = document.createElement('div');
    const skipButton = document.createElement('button');

    overlay.className = 'onboarding-overlay';
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('role', 'dialog');
    card.className = 'onboarding-card';
    skipButton.className = 'onboarding-skip';
    skipButton.type = 'button';
    skipButton.textContent = '跳过';

    overlay.append(skipButton, card);
    container.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    const complete = async () => {
      await saveOnboardingMemories(state);
      markCompleted();
      window.dispatchEvent(new CustomEvent('onboarding:complete', {
        detail: { userName: state.userName },
      }));
      cleanup({ userName: state.userName });
    };

    skipButton.addEventListener('click', () => {
      markSkipped();
      cleanup({ skipped: true });
    });

    card.addEventListener('input', (event) => {
      if (!event.target.classList.contains('onboarding-input')) {
        return;
      }

      state.userName = event.target.value.trim();
      card.querySelector('.onboarding-btn').disabled = !state.userName;
    });

    card.addEventListener('keydown', (event) => {
      if (state.step === 0 && event.key === 'Enter' && state.userName) {
        state.step = 1;
        renderCard(card, state);
      }
    });

    card.addEventListener('click', (event) => {
      const needButton = event.target.closest('[data-need]');
      const interactionButton = event.target.closest('[data-interaction]');
      const confirmButton = event.target.closest('[data-confirm-interaction]');
      const nextButton = event.target.closest('.onboarding-btn');

      if (needButton) {
        state.needs = toggleValue(state.needs, needButton.dataset.need);
        renderCard(card, state);
        return;
      }

      if (confirmButton) {
        const option = INTERACTION_OPTIONS.find((item) => item.label === confirmButton.dataset.confirmInteraction);

        if (!option) {
          return;
        }

        state.interactionPreferences = toggleInteractionPreference(state.interactionPreferences, option);
        state.expandedInteraction = null;
        renderCard(card, state);
        return;
      }

      if (interactionButton) {
        state.expandedInteraction = state.expandedInteraction === interactionButton.dataset.interaction
          ? null
          : interactionButton.dataset.interaction;
        renderCard(card, state);
        return;
      }

      if (!nextButton || nextButton.disabled) {
        return;
      }

      if (state.step === 0 && state.userName) {
        state.step = 1;
        renderCard(card, state);
        return;
      }

      if (state.step === 1 && state.needs.length) {
        state.step = 2;
        renderCard(card, state);
        return;
      }

      if (state.step === 2 && state.interactionPreferences.length) {
        complete();
      }
    });

    renderCard(card, state);
    card.querySelector('.onboarding-input')?.focus();
  });
}
