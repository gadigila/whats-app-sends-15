
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "אבי כהן",
      role: "מנהל שיווק",
      content: "Reecher חסך לי שעות כל שבוע. במקום לשלוח הודעה לכל קבוצה בנפרד, אני שולח לכולן בבת אחת. פשוט מושלם!",
      rating: 5
    },
    {
      name: "רחל לוי",
      role: "עסקה קטנה",
      content: "המערכת פשוטה וקלה להשתמש. התזמון של ההודעות עוזר לי להגיע ללקוחות בזמן הנכון. ממליצה בחום!",
      rating: 5
    },
    {
      name: "דוד ישראלי",
      role: "מארגן אירועים",
      content: "לפני Reecher נדרשתי שעות כדי לעדכן את כל הקבוצות על אירועים. היום זה עניין של דקות. מהפכה אמיתית!",
      rating: 5
    }
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: rating }, (_, i) => (
      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
    ));
  };

  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            מה אומרים המשתמשים שלנו
          </h2>
          <p className="text-gray-600 text-lg">
            אלפי עסקים כבר משתמשים ב-Reecher כדי לחסוך זמן ולהגיע ללקוחות שלהם
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {renderStars(testimonial.rating)}
                </div>
                <p className="text-gray-700 mb-4 text-right leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
