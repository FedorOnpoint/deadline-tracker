package sections

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"deadline-tracker/internal/domain"
)

var customID = regexp.MustCompile(`^custom_[a-zA-Z0-9_-]{1,80}$`)

func ValidateFields(fields, previous []domain.CardField) error {
	if len(fields) < len(domain.DefaultCardFields()) || len(fields) > 60 {
		return domain.Invalid("В шаблоне должно быть от 10 до 60 полей")
	}
	builtins := map[string]domain.CardField{}
	for _, field := range domain.DefaultCardFields() {
		builtins[field.ID] = field
	}
	seen := map[string]domain.CardField{}
	for i := range fields {
		field := &fields[i]
		field.Label = strings.TrimSpace(field.Label)
		if field.Label == "" || utf8.RuneCountInString(field.Label) > 150 {
			return domain.Invalid("Название поля: от 1 до 150 символов")
		}
		if _, duplicate := seen[field.ID]; duplicate {
			return domain.Invalid("Поля шаблона не должны повторяться")
		}
		if field.Visibility != "summary" && field.Visibility != "details" && field.Visibility != "hidden" {
			return domain.Invalid("Выберите отображение поля")
		}
		if field.Required && field.Visibility == "hidden" {
			return domain.Invalid("Обязательное поле нельзя скрыть")
		}
		if builtin, ok := builtins[field.ID]; ok {
			if field.Type != builtin.Type || (builtin.Required && !field.Required) {
				return domain.Invalid("Нельзя менять тип и обязательность основных полей")
			}
			if (field.ID == "topic" || field.ID == "platform_id") && field.Visibility != "summary" {
				return domain.Invalid("Тема и площадка должны быть видны в свёрнутой карточке")
			}
		} else {
			if !customID.MatchString(field.ID) {
				return domain.Invalid("Некорректный идентификатор поля")
			}
			switch field.Type {
			case "text", "textarea", "number", "date", "select", "checkbox":
			default:
				return domain.Invalid("Неизвестный тип поля")
			}
		}
		if len(field.Options) > 100 {
			return domain.Invalid("В списке допускается не более 100 вариантов")
		}
		if field.Type == "select" {
			if len(field.Options) == 0 {
				return domain.Invalid("Добавьте варианты для списка")
			}
			options := map[string]bool{}
			for j, option := range field.Options {
				option = strings.TrimSpace(option)
				if option == "" || utf8.RuneCountInString(option) > 150 || options[option] {
					return domain.Invalid("Варианты списка должны быть непустыми, уникальными и не длиннее 150 символов")
				}
				field.Options[j] = option
				options[option] = true
			}
		} else if len(field.Options) != 0 {
			return domain.Invalid("Варианты доступны только для списка")
		}
		seen[field.ID] = *field
	}
	for id := range builtins {
		if _, ok := seen[id]; !ok {
			return domain.Invalid("Основные поля нельзя удалять; ненужные поля можно скрыть")
		}
	}
	for _, old := range previous {
		field, ok := seen[old.ID]
		if !ok {
			return domain.Invalid("Существующее поле нельзя удалить; скройте его, чтобы сохранить данные")
		}
		if field.Type != old.Type {
			return domain.Invalid("Тип сохранённого поля нельзя менять; добавьте новое поле")
		}
	}
	return nil
}

// A status/completion patch must remain available when a template gains required fields.
func ValidateValues(fields []domain.CardField, values, previous map[string]string, patch bool) error {
	known := map[string]bool{}
	for _, field := range fields {
		if !strings.HasPrefix(field.ID, "custom_") {
			continue
		}
		known[field.ID] = true
		value := values[field.ID]
		if field.Required && strings.TrimSpace(value) == "" && !patch {
			return domain.Invalid("Заполните поле «" + field.Label + "»")
		}
		if field.Required && field.Type == "checkbox" && value != "true" && !patch {
			return domain.Invalid("Установите флажок «" + field.Label + "»")
		}
		if value == "" {
			continue
		}
		if utf8.RuneCountInString(value) > 20000 {
			return domain.Invalid("В поле «" + field.Label + "» допускается не более 20000 символов")
		}
		valid := true
		switch field.Type {
		case "number":
			n, err := strconv.ParseFloat(value, 64)
			valid = err == nil && !math.IsNaN(n) && !math.IsInf(n, 0)
		case "date":
			d, err := time.Parse("2006-01-02", value)
			valid = err == nil && d.Year() >= 1900
		case "checkbox":
			valid = value == "true" || value == "false"
		case "select":
			valid = value == previous[field.ID]
			for _, option := range field.Options {
				if value == option {
					valid = true
				}
			}
		}
		if !valid {
			return domain.Invalid("Некорректное значение поля «" + field.Label + "»")
		}
	}
	for id, value := range values {
		old, exists := previous[id]
		if !known[id] && (!exists || old != value) {
			return domain.Invalid("Неизвестное дополнительное поле")
		}
	}
	return nil
}
