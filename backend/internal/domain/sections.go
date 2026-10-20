package domain

type CardField struct {
	ID         string   `json:"id"`
	Label      string   `json:"label"`
	Type       string   `json:"type"`
	Required   bool     `json:"required"`
	Visibility string   `json:"visibility"`
	Options    []string `json:"options,omitempty"`
}

type TaskSection struct {
	Key      string      `json:"key"`
	Label    string      `json:"label"`
	Position int         `json:"position"`
	Revision int         `json:"revision"`
	Fields   []CardField `json:"fields"`
}

func DefaultCardFields() []CardField {
	return []CardField{
		{ID: "topic", Label: "Тема", Type: "textarea", Required: true, Visibility: "summary"},
		{ID: "platform_id", Label: "Площадка", Type: "catalog", Required: true, Visibility: "summary"},
		{ID: "deadline", Label: "Срок загрузки в Mhub+", Type: "datetime", Required: true, Visibility: "summary"},
		{ID: "email_date", Label: "Дата e-mail", Type: "date", Visibility: "summary"},
		{ID: "specialty_id", Label: "Специальность", Type: "catalog", Visibility: "details"},
		{ID: "project", Label: "Материал / проект", Type: "text", Visibility: "summary"},
		{ID: "owner", Label: "Ответственный", Type: "text", Visibility: "details"},
		{ID: "header", Label: "Хедер", Type: "textarea", Visibility: "details"},
		{ID: "preheader", Label: "Прехедер", Type: "textarea", Visibility: "details"},
		{ID: "comment", Label: "Комментарий", Type: "textarea", Visibility: "details"},
	}
}
