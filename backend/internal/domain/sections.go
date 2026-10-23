package domain

type CardFieldLayout struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type CardField struct {
	ID         string           `json:"id"`
	Label      string           `json:"label"`
	Type       string           `json:"type"`
	Required   bool             `json:"required"`
	Visibility string           `json:"visibility"`
	Options    []string         `json:"options,omitempty"`
	Layout     *CardFieldLayout `json:"layout,omitempty"`
}

type TaskSection struct {
	Key           string      `json:"key"`
	Label         string      `json:"label"`
	Position      int         `json:"position"`
	Revision      int         `json:"revision"`
	Fields        []CardField `json:"fields"`
	DeadlineField string      `json:"deadline_field"`
}

func DefaultCardFields() []CardField {
	return BuiltinCardFields()[:2]
}

func BuiltinCardFields() []CardField {
	return []CardField{
		{ID: "topic", Label: "Название", Type: "textarea", Required: true, Visibility: "summary"},
		{ID: "deadline", Label: "Дата", Type: "datetime", Required: true, Visibility: "summary"},
		{ID: "platform_id", Label: "Площадка", Type: "catalog", Visibility: "summary"},
		{ID: "status_id", Label: "Рабочий статус", Type: "catalog", Visibility: "summary"},
		{ID: "email_date", Label: "Дата e-mail", Type: "date", Visibility: "summary"},
		{ID: "sms", Label: "SMS", Type: "checkbox", Visibility: "summary"},
		{ID: "specialty_id", Label: "Аудитории", Type: "catalog", Visibility: "details"},
		{ID: "project", Label: "Материал / проект", Type: "text", Visibility: "summary"},
		{ID: "owner", Label: "Ответственный", Type: "text", Visibility: "details"},
		{ID: "header", Label: "Хедер", Type: "textarea", Visibility: "details"},
		{ID: "preheader", Label: "Прехедер", Type: "textarea", Visibility: "details"},
		{ID: "comment", Label: "Комментарий", Type: "textarea", Visibility: "details"},
	}
}
