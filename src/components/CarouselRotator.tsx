import { Flex, FlexProps } from '@chakra-ui/core';
import React, { useContext, useEffect, useRef } from 'react';
import { useInterval } from 'web-api-hooks';
import useCarouselControls from '../hooks/useCarouselControls';
import CarouselContext from './CarouselContext';
import CarouselSlide from './CarouselSlide';

// TODO: https://www.w3.org/TR/wai-aria-practices-1.1/#tabbed-carousel-elements

export interface CarouselRotatorProps extends FlexProps {
  children: React.ReactElement[];
  playInterval?: number;
  activeIndex?: number;
}

export default function CarouselRotator({
  children,
  playInterval = 5000,
  activeIndex: controlledActiveIndex,
  ...restProps
}: CarouselRotatorProps) {
  const [
    isHovered,
    isFocused,
    [disableAutoPause],
    [uncontrolledActiveIndex, setUncontrolledActiveIndex],
    [, setSlides],
  ] = useContext(CarouselContext);
  const { isPlaying, jump } = useCarouselControls();
  const activeIndex =
    controlledActiveIndex != null
      ? controlledActiveIndex
      : uncontrolledActiveIndex;

  // Auto-rotate slides if desired
  useInterval(
    () => {
      jump(+1);
    },
    isPlaying && ((!isHovered && !isFocused) || disableAutoPause)
      ? playInterval
      : null,
  );

  // Track scroll position
  const rotatorRef = useRef<HTMLElement>();
  useEffect(() => {
    // Skip observation when the component is controlled or not mounted
    if (controlledActiveIndex != null || !rotatorRef.current) return undefined;

    const slides = [...rotatorRef.current.children];
    setSlides(slides as HTMLElement[]);

    const observer = new IntersectionObserver(
      entries => {
        const intersectingEntry = entries.find(entry => entry.isIntersecting);
        if (intersectingEntry) {
          // Scroll events shall not be fired here, so `goTo` cannot be used
          setUncontrolledActiveIndex(slides.indexOf(intersectingEntry.target));
        }
      },
      { threshold: 0.5 },
    );
    slides.forEach(slide => {
      observer.observe(slide);
    });

    return () => {
      observer.disconnect();
    };
  }, [children, controlledActiveIndex, setSlides, setUncontrolledActiveIndex]);

  return (
    <Flex
      ref={rotatorRef}
      aria-atomic={false}
      aria-live={isPlaying ? 'off' : 'polite'}
      onMouseDown={e => {
        // Disable mouse wheel scrolling between slides
        if (e.button === 1) e.preventDefault();
      }}
      position="relative"
      overflow={
        // Disable user-initiated scrolling when the component is controlled
        controlledActiveIndex != null ? 'hidden' : 'auto'
      }
      css={{
        scrollSnapType: 'x mandatory',
        scrollBehavior: 'smooth',
        // TODO: Leave vendor prefixing to the underlying library
        '::-webkit-scrollbar': { width: 0 },
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}
      {...restProps}
    >
      {React.Children.map(children, (child, i) => (
        // Labels are lifted up to comply with WAI-ARIA Authoring Practices
        <CarouselSlide
          inert={i !== activeIndex ? '' : undefined}
          aria-label={child.props['aria-label']}
          aria-labelledby={child.props['aria-labelledby']}
        >
          {React.cloneElement(child, {
            'aria-label': undefined,
            'aria-labelledby': undefined,
          })}
        </CarouselSlide>
      ))}
    </Flex>
  );
}
