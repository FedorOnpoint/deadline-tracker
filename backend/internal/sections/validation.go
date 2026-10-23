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
	if len(fields) < 2 || len(fields) > 60 {
		return domain.Invalid("Допускается от 2 до 60 полей")
	}
	builtins := map[string]domain.CardField{}
	for _, field := range domain.BuiltinCardFields() {
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
			if field.ID == "topic" && field.Visibility != "summary" {
				return domain.Invalid("Название должно быть видно в свёрнутой карточке")
			}
		} else {
			if !customID.MatchString(field.ID) {
				return domain.Invalid("Некорректный идентификатор поля")
			}
			switch field.Type {
			case "text", "textarea", "number", "date", "datetime", "select", "checkbox":
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
	for id, builtin := range builtins {
		if _, ok := seen[id]; builtin.Required && !ok {
			return domain.Invalid("Название и дату нельзя удалять")
		}
	}
	for _, old := range previous {
		field, ok := seen[old.ID]
		if !ok {
			continue
		}
		if field.Type != old.Type {
			return domain.Invalid("Тип сохранённого поля нельзя менять; добавьте новое поле")
		}
	}
	return validateLayouts(fields)
}

func validateLayouts(fields []domain.CardField) error {
	for index, field := range fields {
		box := field.Layout
		if box == nil {
			continue
		}
		if box.X < 0 || box.Y < 0 || box.Width < 3 || box.Width > 12 || box.Height < 2 || box.Height > 24 || box.X > 12-box.Width || box.Y > 4096-box.Height {
			return domain.Invalid("Некорректные размеры или положение блока «" + field.Label + "»")
		}
		if field.Visibility == "hidden" {
			continue
		}
		for _, other := range fields[:index] {
			previous := other.Layout
			if previous == nil || field.Visibility != other.Visibility {
				continue
			}
			if box.X < previous.X+previous.Width && previous.X < box.X+box.Width && box.Y < previous.Y+previous.Height && previous.Y < box.Y+box.Height {
				return domain.Invalid("Блоки «" + field.Label + "» и «" + other.Label + "» перекрываются")
			}
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
		case "datetime":
			d, err := time.Parse(time.RFC3339, value)
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

func ValidateDeadlineField(fields []domain.CardField, id string) error {
	if id == "" {
		id = "deadline"
	}
	for _, field := range fields {
		if field.ID == id && (field.Type == "date" || field.Type == "datetime") && field.Visibility != "hidden" {
			return nil
		}
	}
	return domain.Invalid("Выберите видимое поле с датой для отсчёта дедлайна")
}
