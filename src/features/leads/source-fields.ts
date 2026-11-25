export type LeadQuestionField = {
  key: string;
  label: string;
  formName?: string;
};

const questionFields: Record<string, LeadQuestionField[]> = {
  goa: [
    { key: "remark14oct", label: "Remark (14 Oct)" },
    { key: "date", label: "Travel date" },
    { key: "remark15oct", label: "Remark (15 Oct)" },
  ],
  dubai: [
    { key: "dubaiPurpose", label: "What is the purpose of your Dubai trip?" },
    { key: "uaeVisa", label: "Do you have a valid UAE/Dubai visa?" },
    { key: "travelDate", label: "When are you planning to travel?" },
    { key: "flightsIncluded", label: "Do you need flights included in the package?" },
    { key: "validPassport", label: "Do you have a valid passport?" },
    { key: "budgetPerPerson", label: "What is your approximate budget per person?" },
    { key: "travellers", label: "How many people are travelling?" },
  ],
  manali: [
    { key: "travellers", label: "How many people are travelling?" },
    { key: "bookingTimeline", label: "How soon are you planning to book?" },
    { key: "travelDate", label: "When would you like to travel to Manali?" },
    { key: "remark", label: "Remark" },
  ],
};

const fieldByFormName = new Map(
  Object.entries(questionFields).flatMap(([packageName, fields]) =>
    fields.map((field) => [
      `custom_${packageName}_${field.key}`,
      field.label,
    ] as const),
  ),
);

export function getLeadQuestionFields(packageName: string | undefined) {
  const normalizedName = packageName?.trim().toLowerCase() ?? "";
  const destination = Object.keys(questionFields).find((name) =>
    normalizedName.includes(name),
  );
  return destination
    ? questionFields[destination].map((field) => ({
        ...field,
        formName: `custom_${destination}_${field.key}`,
      }))
    : [];
}

export function readManualSourceData(formData: FormData) {
  const sourceData: Record<string, string> = {};
  for (const [formName, label] of fieldByFormName) {
    const value = formData.get(formName);
    if (typeof value === "string" && value.trim()) {
      sourceData[label] = value.trim().slice(0, 2000);
    }
  }
  return sourceData;
}

export function readCsvSourceData(headers: string[], row: string[]) {
  const sourceData: Record<string, string> = {};
  headers.forEach((header, index) => {
    const label = header.trim().slice(0, 100);
    const value = row[index]?.trim();
    if (
      label &&
      value &&
      !["category", "leadcategory"].includes(
        label.toLowerCase().replace(/[\s_-]+/g, ""),
      )
    ) {
      sourceData[label] = value.slice(0, 2000);
    }
  });
  return sourceData;
}
