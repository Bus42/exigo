import { Flex, FlexProps } from '@chakra-ui/core';
import { css } from '@emotion/core';
import ResizeObserverPolyfill from '@juggle/resize-observer';
import React, { useEffect, useRef } from 'react';
import {
  usePreferredMotionIntensity,
  useSize,
  useWindowSize,
} from 'web-api-hooks';

const IS_RESIZING_DEBOUNCE_INTERVAL_MS = 150;

function scroll(
  container: HTMLElement,
  targetIndex: number,
  behavior: ScrollOptions['behavior'] = 'auto',
) {
  const targetChild = container.children[targetIndex] as HTMLElement;
  /* eslint-disable no-param-reassign */
  // Fix momentum-based scrolling issues on iOS
  // See: https://www.popmotion.io/blog/20170704-manually-set-scroll-while-ios-momentum-scroll-bounces/
  container.style.overflowX = 'hidden';
  container.scroll({
    left: targetChild.offsetLeft,
    behavior,
  });
  container.style.overflowX = 'auto';
  /* eslint-enable no-param-reassign */
}

export interface ScrollSnapContainerProps extends FlexProps {
  shownIndex: number;
  targetIndex: number | null;
  onShownIndexChange: (index: number) => void;
  onTargetIndexChange: (index: null) => void;
}

export default function ScrollSnapContainer({
  children,
  shownIndex,
  targetIndex,
  onShownIndexChange,
  onTargetIndexChange,
  ...restProps
}: ScrollSnapContainerProps) {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const ref = useRef<HTMLElement>(null);
  const isScrollObserverDisabled = useRef(false);

  // Re-snap scroll position when content of the snapport changes
  // TODO: Remove when browsers handle this natively
  const [width] = useSize(
    ref,
    (typeof window !== 'undefined' && window.ResizeObserver) ||
      ((ResizeObserverPolyfill as unknown) as typeof ResizeObserver),
  );
  // Handle device orientation changes properly on iOS
  const [windowWidth] = useWindowSize();
  useEffect(() => {
    isScrollObserverDisabled.current = true;
    scroll(ref.current!, targetIndex != null ? targetIndex : shownIndex);
    const timeoutID = window.setTimeout(() => {
      isScrollObserverDisabled.current = false;
    }, IS_RESIZING_DEBOUNCE_INTERVAL_MS);
    return () => {
      window.clearTimeout(timeoutID);
    };
    // Changing indexes shall not have an effect on scroll restoration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, windowWidth]);

  // TODO: Replace this check with CSS when no polyfill is required
  const preferReducedMotion = usePreferredMotionIntensity() === 'reduce';

  // Scroll to the desired target each time it changes
  useEffect(() => {
    if (targetIndex != null) {
      isScrollObserverDisabled.current = false;
      scroll(
        ref.current!,
        targetIndex,
        preferReducedMotion ? 'auto' : 'smooth',
      );
    }
  }, [preferReducedMotion, targetIndex]);

  // Track shown element's index based on scroll position
  function handleScroll() {
    if (!isScrollObserverDisabled.current) {
      const nextIndex = Math.round(
        (ref.current!.scrollLeft / ref.current!.scrollWidth) *
          React.Children.count(children),
      );
      if (nextIndex !== shownIndex) {
        onShownIndexChange(nextIndex);
        onTargetIndexChange(null);
      }
    }
  }

  return (
    <Flex
      ref={ref}
      overflowX="auto"
      css={css`
        /* Support every version of CSS Scroll Snap */
        scroll-snap-type-x: mandatory;
        -ms-scroll-snap-type: mandatory;
        scroll-snap-type: x mandatory;
        -ms-scroll-snap-points-x: snapInterval(0, 100%);
        scroll-snap-points-x: repeat(100%);

        /* Optimize scrolling behavior */
        will-change: scroll-position;
        -webkit-overflow-scrolling: touch;

        /* Hide scrollbar */
        /* TODO: Leave vendor prefixing to the underlying library */
        ::-webkit-scrollbar {
          display: none;
        }
        -ms-overflow-style: none;
        scrollbar-width: none;
      `}
      onScroll={handleScroll}
      {...restProps}
    >
      {children}
    </Flex>
  );
}
