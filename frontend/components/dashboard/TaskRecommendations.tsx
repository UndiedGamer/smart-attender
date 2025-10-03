'use client';

import { BookOpen, Brain, Rocket } from 'lucide-react';

interface TaskRecommendation {
  id: string;
  title: string;
  description: string;
  focusArea: 'concept-reinforcement' | 'skills-practice' | 'career-exposure';
  gradeLevel: string;
  duration: string;
}

const ICONS = {
  'concept-reinforcement': BookOpen,
  'skills-practice': Brain,
  'career-exposure': Rocket
};

const mockRecommendations: TaskRecommendation[] = [
  {
    id: 'task-1',
    title: 'Adaptive algebra drills',
    description: 'AI-curated problem set focusing on factoring quadratics and graph interpretation.',
    focusArea: 'concept-reinforcement',
    gradeLevel: 'Grade 10',
    duration: '15 min'
  },
  {
    id: 'task-2',
    title: 'Lab safety mini-quest',
    description: 'Short interactive module preparing students for tomorrow’s physics lab experiment.',
    focusArea: 'skills-practice',
    gradeLevel: 'Grade 12',
    duration: '20 min'
  },
  {
    id: 'task-3',
    title: 'Career sparks: data analyst',
    description: 'Micro-experience connecting current math topics to real-world applications in analytics.',
    focusArea: 'career-exposure',
    gradeLevel: 'Grade 11',
    duration: '10 min'
  }
];

export function TaskRecommendations() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Free-period tasks</h3>
          <p className="text-sm text-slate-500">Suggested activities tailored to current performance signals.</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {mockRecommendations.map((task) => {
          const Icon = ICONS[task.focusArea];
          return (
            <div key={task.id} className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                <Icon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-slate-900">{task.title}</h4>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary-600">
                    {task.duration}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {task.gradeLevel} • Focus: {task.focusArea.replace('-', ' ')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
