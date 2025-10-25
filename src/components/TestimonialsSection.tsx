
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "אור",
      role: "מנהל רשת שיווק שותפים",
      content: "יש לי עשרות קבוצות שיווק שותפים. לפני Reecher הייתי מעתיק ומדביק את אותה הודעה 40 פעם. היום אני מגיע לכולם בדקה אחת.",
      rating: 5
    },
    {
      name: "נופר",
      role: "מאמנת ריצה",
      content: "אני מנהלת 12 קבוצות אתגרי ריצה. עם Reecher אני מכינה את כל התזכורות פעם בשבוע ושוכחת מזה. זה פשוט משחרר.",
      rating: 5
    },
    {
      name: "ליאור",
      role: "מומחה AI וניהול קהילות",
      content: "יש לי 8 קבוצות AI וזה הולך וגדל. עכשיו אני יושב פעם בחודש, מכין את כל התוכן מראש ומתזמן. זמן זה כסף, ו-Reecher חוסך לי את שניהם.",
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
          <h2 className="text-3xl font-bold text-gray-900 mb-4 animate-fade-in-up">
            מה אומרים המשתמשים
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className={`border-gray-200 hover:shadow-lg transition-shadow animate-fade-in-up delay-${(index + 1) * 200}`}>
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
