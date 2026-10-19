package tasks

import (
	"context"
	"time"

	"deadline-tracker/internal/domain"
)

func (service *Service) CreateExamples(ctx context.Context, userID int64) (bool, error) {
	created := false
	err := service.Repository.Transaction(ctx, func(tx Transaction) error {
		claimed, err := tx.ClaimExamples(ctx, userID)
		if err != nil || !claimed {
			return err
		}
		platforms, err := tx.ActiveCatalogIDs(ctx, userID, "platform")
		if err != nil {
			return err
		}
		if len(platforms) == 0 {
			return domain.Invalid("Для примеров нужна хотя бы одна активная площадка")
		}
		statuses, err := tx.ActiveCatalogIDs(ctx, userID, "status")
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		topics := []string{
			"ШР_1: Эрозивная ГЭРБ: как повысить вероятность заживления",
			"Тегопрекс — баннеры",
			"Новости клинической практики",
			"БАННЕР",
			"Подготовка экспертного материала",
			"ШР_1: Эрозивная ГЭРБ: как повысить вероятность заживления",
			"Обзор исследований",
			"Письмо для врачей общей практики",
			"Редакционная подборка",
			"Итоги месяца",
		}
		days := []int{-2, 2, 5, 8, 14, 21, 30, 3, -3, 10}
		for i, topic := range topics {
			var status *int64
			if i < len(statuses) {
				status = &statuses[i]
			}
			deadline := now.Add(time.Duration(days[i]) * 24 * time.Hour)
			email := ""
			if i%3 != 0 {
				email = deadline.Add(24 * time.Hour).Format("2006-01-02")
			}

			task := domain.Task{
				PlatformID: platforms[i%len(platforms)],
				StatusID:   status,
				Deadline:   deadline,
				EmailDate:  email,
				Completed:  i >= 8,
				Topic:      topic,
				Project:    "Тегопразан Эрозивная ГЭРБ",
				Header:     "Практика, которая помогает пациентам",
				Preheader:  "Материалы для медицинских специалистов",
				Comment:    "Демонстрационная запись. Даты заданы относительно момента создания примеров.",
				Owner:      "Анна",
			}
			if _, err := tx.Insert(ctx, userID, task); err != nil {
				return err
			}
		}
		created = true
		return nil
	})
	return created, err
}
