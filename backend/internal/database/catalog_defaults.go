package database

var defaultCatalogNames = map[string][]string{
	"platform":  {"База Медзнат", "Отправки Medpoint", "Отправки Onpoint"},
	"specialty": {"Gastro", "GP"},
	"status": {
		"Пишем",
		"На согласовании",
		"Дорабатываем",
		"Загружено DROID",
		"Mhub",
		"Дизайн",
		"Согласовано БМ",
		"Ждем размещение МЗ",
		"Корректор",
	},
}
var defaultStatusColors = []string{
	"#a9b9cf",
	"#e2be77",
	"#edaa87",
	"#b4a1df",
	"#8ebfd1",
	"#d39bbb",
	"#9fc5a3",
	"#b2c88e",
	"#c1b4a4",
}
