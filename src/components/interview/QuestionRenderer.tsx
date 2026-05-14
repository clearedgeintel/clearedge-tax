"use client";

import { useMemo } from "react";
import { type Control } from "react-hook-form";
import { HelpCircle } from "lucide-react";
import type { Question, AnswerMap } from "@/lib/interview/types";
import { isQuestionVisible } from "@/lib/interview/condition-evaluator";
import YesNoInput from "./inputs/YesNoInput";
import MultipleChoiceInput from "./inputs/MultipleChoiceInput";
import MultiSelectInput from "./inputs/MultiSelectInput";
import TextInput from "./inputs/TextInput";
import NumberInput from "./inputs/NumberInput";
import CurrencyInput from "./inputs/CurrencyInput";
import DateInput from "./inputs/DateInput";
import EinInput from "./inputs/EinInput";
import SsnInput from "./inputs/SsnInput";
import PhoneInput from "./inputs/PhoneInput";
import EmailInput from "./inputs/EmailInput";
import AddressInput from "./inputs/AddressInput";
import PercentageInput from "./inputs/PercentageInput";
import FileUploadInput from "./inputs/FileUploadInput";
import StateSelectInput from "./inputs/StateSelectInput";
import StateMultiSelectInput from "./inputs/StateMultiSelectInput";

interface Props {
  question: Question;
  answers: AnswerMap;
  control: Control<Record<string, unknown>>;
  fieldPrefix?: string;
}

export default function QuestionRenderer({
  question,
  answers,
  control,
  fieldPrefix = "",
}: Props) {
  const visible = useMemo(
    () => isQuestionVisible(question, answers),
    [question, answers]
  );

  if (!visible) return null;
  if (question.inputType === "section_include") return null;

  const fieldName = fieldPrefix
    ? `${fieldPrefix}.${question.questionId}`
    : question.questionId;

  const isRequired = question.validation?.required !== false;

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <label className="block mb-2">
        <span className="text-sm font-medium text-gray-800">
          {question.text}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </span>
        {question.helpText && (
          <span className="inline-flex items-center ml-1.5 group relative">
            <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 p-2 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {question.helpText}
            </span>
          </span>
        )}
      </label>

      <div className="mt-1">
        <InputSwitch
          inputType={question.inputType}
          name={fieldName}
          control={control}
          question={question}
        />
      </div>
    </div>
  );
}

function InputSwitch({
  inputType,
  name,
  control,
  question,
}: {
  inputType: string;
  name: string;
  control: Control<Record<string, unknown>>;
  question: Question;
}) {
  switch (inputType) {
    case "yes_no":
      return <YesNoInput name={name} control={control} />;
    case "multiple_choice":
      return (
        <MultipleChoiceInput
          name={name}
          control={control}
          options={question.options || []}
        />
      );
    case "multi_select":
      return (
        <MultiSelectInput
          name={name}
          control={control}
          options={question.options || []}
        />
      );
    case "text":
      return (
        <TextInput
          name={name}
          control={control}
          maxLength={question.validation?.max}
        />
      );
    case "number":
      return (
        <NumberInput
          name={name}
          control={control}
          min={question.validation?.min}
          max={question.validation?.max}
        />
      );
    case "currency":
      return (
        <CurrencyInput
          name={name}
          control={control}
          min={question.validation?.min}
          max={question.validation?.max}
        />
      );
    case "date":
      return (
        <DateInput
          name={name}
          control={control}
          minDate={question.validation?.minDate}
          maxDate={question.validation?.maxDate}
        />
      );
    case "ein":
      return <EinInput name={name} control={control} />;
    case "ssn":
      return <SsnInput name={name} control={control} />;
    case "phone":
      return <PhoneInput name={name} control={control} />;
    case "email":
      return <EmailInput name={name} control={control} />;
    case "address":
      return <AddressInput name={name} control={control} />;
    case "percentage":
      return (
        <PercentageInput
          name={name}
          control={control}
          min={question.validation?.min}
          max={question.validation?.max}
        />
      );
    case "file_upload":
      return <FileUploadInput name={name} control={control} />;
    case "state_select":
      return <StateSelectInput name={name} control={control} />;
    case "state_multi_select":
      return <StateMultiSelectInput name={name} control={control} />;
    default:
      return (
        <TextInput name={name} control={control} placeholder={`(${inputType})`} />
      );
  }
}
