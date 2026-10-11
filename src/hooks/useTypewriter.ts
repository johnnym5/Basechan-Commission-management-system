import { useEffect, useState } from 'react';

export function useTypewriter(
  prompts: string[],
  isPaused: boolean,
  speed = 80,
  pauseDelay = 3000
): string {
  const [displayText, setDisplayText] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isPaused || prompts.length === 0) {
      setDisplayText('');
      return;
    }

    const currentPrompt = prompts[promptIndex % prompts.length];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentPrompt.slice(0, displayText.length + 1));
        if (displayText.length === currentPrompt.length) {
          setTimeout(() => setIsDeleting(true), pauseDelay);
        }
      } else {
        setDisplayText(currentPrompt.slice(0, displayText.length - 1));
        if (displayText.length === 0) {
          setIsDeleting(false);
          setPromptIndex((idx) => (idx + 1) % prompts.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, promptIndex, isPaused, prompts, speed, pauseDelay]);

  return isPaused ? '' : displayText;
}
