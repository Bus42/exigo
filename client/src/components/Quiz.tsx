import { Text } from '@chakra-ui/core';
import { css } from '@emotion/core';
import debounce from 'just-debounce';
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { QuizItemType } from '../models.generated.d';
import { Quiz } from '../models/Quiz';
import QuizAnswers from '../models/QuizAnswers';
import QuizItem from '../models/QuizItem';
import MultipleOptionsQuizItem from '../models/QuizItems/MultipleOptionsQuizItem';
import NumericQuizItem from '../models/QuizItems/NumericQuizItem';
import QuizItemModelType from '../models/QuizItemType';
import CarouselContainer from './CarouselContainer';
import CarouselProvider from './CarouselProvider';
import CarouselRotator from './CarouselRotator';
import Measure from './Measure';
import {
  GetQuizQuery,
  useGetQuizQuery,
  useUpdateQuizItemMutation,
} from './Quiz.generated';
import QuizEvaluatorActions from './QuizEvaluatorActions';
import QuizItemCard from './QuizItemCard';
import QuizItemEditor from './QuizItemEditor';
import QuizItemEvaluator from './QuizItemEvaluator';

function daoToQuiz(
  quizID: Quiz['id'],
  queryResult: GetQuizQuery | undefined,
): Quiz | undefined {
  if (!queryResult?.quiz) return undefined;

  const { items, ...quizBase } = queryResult.quiz;
  return {
    ...quizBase,
    id: quizID,
    items: items.map(({ id, type, stem, ...fragments }) => {
      /* eslint-disable @typescript-eslint/camelcase, @typescript-eslint/no-non-null-assertion */
      if (type === QuizItemType.MultipleOptions) {
        const {
          options,
          constraints_minCount,
          constraints_maxCount,
        } = fragments.fragmentMultipleOptions!;
        const solution = options
          .filter(option => option.isSolution)
          .map(option => option.id);
        return {
          id,
          type: QuizItemModelType.MULTIPLE_OPTIONS,
          stem,
          solution,
          options,
          constraints: {
            minCount: constraints_minCount,
            maxCount: constraints_maxCount,
          },
        } as MultipleOptionsQuizItem;
      }

      if (type === QuizItemType.Numeric) {
        const {
          precision,
          stepSize,
          constraints_minValue,
          constraints_maxValue,
          solution,
        } = fragments.fragmentNumeric!;
        return {
          id,
          type: QuizItemModelType.NUMERIC,
          stem,
          solution,
          precision,
          stepSize,
          constraints: {
            minValue: constraints_minValue,
            maxValue: constraints_maxValue,
          },
        } as NumericQuizItem;
      }
      /* eslint-enable @typescript-eslint/camelcase, @typescript-eslint/no-non-null-assertion */

      return undefined as never;
    }),
  };
}

function quizItemToDao(quizItem: QuizItem) {
  if (quizItem.type === QuizItemModelType.MULTIPLE_OPTIONS) {
    const { id, stem, constraints, solution } = quizItem;
    return {
      id,
      type: QuizItemType.MultipleOptions,
      stem,
      fragmentMultipleOptions: {
        update: {
          constraints_minCount: constraints?.minCount,
          constraints_maxCount: constraints?.maxCount,
          // TODO: Update `options`
        },
      },
    };
  }

  if (quizItem.type === QuizItemModelType.NUMERIC) {
    const { id, stem, precision, stepSize, constraints, solution } = quizItem;
    return {
      id,
      type: QuizItemType.Numeric,
      stem,
      fragmentNumeric: {
        update: {
          precision,
          stepSize,
          constraints_minValue: constraints?.minValue,
          constraints_maxValue: constraints?.maxValue,
          solution,
        },
      },
    };
  }

  return undefined as never;
}

// TODO: Allow creating items of other types
function createDummyQuizItem(): NumericQuizItem {
  return { id: '', type: QuizItemModelType.NUMERIC, stem: '' };
}

export interface QuizProps {
  id: string;
  isEditable?: boolean;
}

export default function QuizComponent({ id: quizID, isEditable }: QuizProps) {
  const [remainingItems, setRemainingItems] = useState<QuizItem[]>([]);
  const [responses, setResponses] = useState<QuizAnswers>({});

  const [itemBeingRemoved, setItemBeingRemoved] = useState<QuizItem>();

  const [, updateQuizItem] = useUpdateQuizItemMutation();
  const debouncedUpdateQuizItem = debounce(updateQuizItem, 400);

  const [res] = useGetQuizQuery({
    variables: { id: quizID },
    pause: isEditable && remainingItems.length > 1,
  });
  const quiz = daoToQuiz(quizID, res.data);
  const items = quiz?.items || [];

  useEffect(() => {
    setRemainingItems(
      isEditable
        ? [...items, createDummyQuizItem()]
        : // Simulate that solutions are not given at first
          items.map(({ solution, ...itemProps }) => itemProps),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  if (res.fetching) return <Text>Loading…</Text>;
  if (res.error) return <Text>Failed to load.</Text>;

  if (!quiz) {
    return <Text>Quiz cannot be found.</Text>;
  }

  return (
    <Measure mx="auto">
      <Helmet>
        <title>{quiz.title}</title>
      </Helmet>

      <CarouselProvider>
        <CarouselContainer mt={-6}>
          <CarouselRotator
            ignoreTargetChange={itemBeingRemoved != null}
            maxHeight="fill-available"
            onScrollEnd={() => {
              if (itemBeingRemoved != null) {
                setItemBeingRemoved(undefined);
                setRemainingItems(prevRemainingItems => {
                  const index = prevRemainingItems.indexOf(itemBeingRemoved);
                  return [
                    ...prevRemainingItems.slice(0, index),
                    ...prevRemainingItems.slice(index + 1),
                  ];
                });
              }
            }}
            // TODO: Use `sx` prop when Chakra switches to Theme UI
            css={theme => css`
              > * {
                padding: ${theme.space[6]} ${theme.space[4]};
              }
            `}
          >
            {remainingItems.map((item, i) => {
              return (
                <QuizItemCard
                  key={item.id}
                  item={item}
                  shownIndex={items.findIndex(({ id }) => id === item.id)}
                  totalCount={items.length}
                  isEditable={isEditable}
                  onStemChange={stem => {
                    setRemainingItems(prevItems => {
                      debouncedUpdateQuizItem({
                        id: item.id,
                        data: { stem },
                      });
                      return [
                        ...prevItems.slice(0, i),
                        { ...prevItems[i], stem },
                        ...prevItems.slice(i + 1),
                      ];
                    });
                  }}
                >
                  {isEditable ? (
                    <QuizItemEditor
                      item={item}
                      onChange={nextItem => {
                        debouncedUpdateQuizItem({
                          id: item.id,
                          data: quizItemToDao(nextItem),
                        });
                        setRemainingItems(prevItems => {
                          return [
                            ...prevItems.slice(0, i),
                            nextItem,
                            ...prevItems.slice(i + 1),
                          ];
                        });
                      }}
                    />
                  ) : (
                    <QuizItemEvaluator
                      item={item}
                      onChange={response => {
                        setResponses(prevResponses => ({
                          ...prevResponses,
                          [item.id]: response,
                        }));
                      }}
                    />
                  )}
                </QuizItemCard>
              );
            })}
          </CarouselRotator>
        </CarouselContainer>

        <QuizEvaluatorActions
          remainingItems={remainingItems}
          responses={responses}
          disableNavigation={itemBeingRemoved != null}
          mt={2}
          px={4}
          onCheckAnswer={item =>
            setRemainingItems(prevRemainingItems => {
              const index = prevRemainingItems.findIndex(
                ({ id }) => id === item.id,
              );
              return [
                ...prevRemainingItems.slice(0, index),
                {
                  ...item,
                  // TODO: Load solution from the server if desired
                  solution: items.find(({ id }) => id === item.id)
                    ?.solution as any,
                },
                ...prevRemainingItems.slice(index + 1),
              ];
            })
          }
          onSurrender={setItemBeingRemoved}
        />
      </CarouselProvider>
    </Measure>
  );
}
