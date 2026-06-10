import logging

logger = logging.getLogger(__name__)

class SMSService:
    """
    İleride NetGSM, Twilio gibi gerçek servislere bağlanmak için kullanılacak servis katmanı.
    """
    
    @staticmethod
    def send_verification_sms(phone: str, tc_no: str, code: str) -> bool:
        """
        Şifremi unuttum doğrulama kodunu gönderen mock (sahte) servis.
        Gerçek entegrasyon yapılana kadar konsola yazar.
        """
        # TODO: Gerçek SMS API Entegrasyonu eklenebilir.
        # Örnek: NetGSM veya Twilio API çağrıları burada yapılacak.
        
        message = f"Erişimli Randevu şifre sıfırlama kodunuz: {code}. Bu kodu kimseyle paylaşmayınız."
        
        logger.info("=" * 50)
        logger.info(f"MOCK SMS GÖNDERİLDİ")
        logger.info(f"Alıcı TC: {tc_no}")
        if phone:
            logger.info(f"Alıcı Telefon: {phone}")
        else:
            logger.info(f"Alıcı Telefon: (Sistemde kayıtlı telefon yok)")
        logger.info(f"Mesaj: {message}")
        logger.info("=" * 50)
        
        return True
