import { Flex, FlexProps, usePrevious } from '@chakra-ui/core';
import { css } from '@emotion/core';
import React, { useCallback, useContext, useEffect } from 'react';
import { InView } from 'react-intersection-observer';
import { useInterval, useWindowSize } from 'web-api-hooks';
import useCarouselControls from '../hooks/useCarouselControls';
import CarouselContext from './CarouselContext';
import CarouselSlide from './CarouselSlide';

// TODO: https://www.w3.org/TR/wai-aria-practices-1.1/#tabbed-carousel-elements

(async function loadPolyfill() {
  if (typeof window.IntersectionObserver === 'undefined') {
    await import('intersection-observer');
  }
})();

export interface CarouselRotatorProps extends FlexProps {
  children: React.ReactElement[];
  playInterval?: number;
  activeIndex?: number;
}

export default function CarouselRotator({
  children,
  playInterval = 5000,
  activeIndex: controlledActiveIndex,
  style,
  ...restProps
}: CarouselRotatorProps) {
  const [
    isHovered,
    isFocused,
    [disableAutoPause],
    [uncontrolledActiveIndex, setUncontrolledActiveIndex],
    [, setTotalCount],
    slidesRef,
  ] = useContext(CarouselContext);
  const { isPlaying, jump } = useCarouselControls();
  const activeIndex =
    controlledActiveIndex != null
      ? controlledActiveIndex
      : uncontrolledActiveIndex;

  // Keep amount of slides updated
  useEffect(() => {
    const totalCount = React.Children.count(children);
    setTotalCount(totalCount);
    slidesRef.current.splice(totalCount);
  }, [children, setTotalCount, slidesRef]);

  // Auto-rotate slides if desired
  useInterval(
    () => {
      jump(+1);
    },
    isPlaying && ((!isHovered && !isFocused) || disableAutoPause)
      ? playInterval
      : null,
  );

  // Re-snap scroll position when content of the snapport changes
  // TODO: Remove when browsers handle this natively
  const [windowWidth] = useWindowSize();
  const prevWindowWidth = usePrevious(windowWidth);
  useEffect(() => {
    if (windowWidth !== prevWindowWidth) {
      const slide = slidesRef.current[activeIndex];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      slide.parentElement!.scroll({
        left: slide.offsetLeft,
        behavior: 'auto',
      });
    }
  }, [activeIndex, prevWindowWidth, slidesRef, windowWidth]);

  return (
    <Flex
      aria-atomic={false}
      aria-live={isPlaying ? 'off' : 'polite'}
      onMouseDown={useCallback(e => {
        // Disable mouse wheel scrolling between slides
        if (e.button === 1) e.preventDefault();
      }, [])}
      position="relative"
      overflow={
        // Disable user-initiated scrolling when the component is controlled
        controlledActiveIndex != null ? 'hidden' : 'auto'
      }
      css={css`
        /* Support every version of CSS Scroll Snap */
        scroll-snap-type: x mandatory;
        scroll-snap-type-x: mandatory;
        scroll-snap-points-x: repeat(100%);

        /* TODO: Leave vendor prefixing to the underlying library */
        ::-webkit-scrollbar {
          display: none;
        }
        overflow: -moz-scrollbars-none;
        -ms-overflow-style: none;
        scrollbar-width: none;

        @media (prefers-reduced-motion: reduce) {
          scroll-behavior: auto;
        }
      `}
      style={{ scrollBehavior: 'smooth', ...style }}
      {...restProps}
    >
      {React.Children.map(children, (child, i) => (
        <InView
          threshold={0.5}
          onChange={inView => {
            if (inView) setUncontrolledActiveIndex(i);
          }}
        >
          {// eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ ref, inView }) => {
            return (
              // Labels are lifted up to comply with WAI-ARIA Authoring Practices
              <CarouselSlide
                ref={(element: HTMLElement) => {
                  (ref as (node: Element) => void)(element);
                  slidesRef.current[i] = element;
                }}
                inert={!inView ? '' : undefined}
                aria-label={child.props['aria-label']}
                aria-labelledby={child.props['aria-labelledby']}
              >
                {React.cloneElement(child, {
                  'aria-label': undefined,
                  'aria-labelledby': undefined,
                })}
              </CarouselSlide>
            );
          }}
        </InView>
      ))}
    </Flex>
  );
}
